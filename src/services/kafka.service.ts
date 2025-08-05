import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  Admin,
  Consumer,
  EachMessagePayload,
  GroupDescription,
  ITopicMetadata,
  Kafka,
  Partitioners,
  Producer,
} from 'kafkajs';
import { SseService } from './sse.service';
import { SseEvent } from '../shared/types';

export interface KafkaConfig {
  clientId: string;
  brokers: string[];
  ssl?: boolean;
  sasl?: any; // Use any to avoid complex type issues with kafkajs SASL types
}

export interface ProduceMessageOptions {
  topic: string;
  messages: Array<{
    key?: string;
    value: string;
    partition?: number;
    headers?: Record<string, string>;
  }>;
}

export interface ConsumeMessageOptions {
  topic: string;
  groupId: string;
  fromBeginning?: boolean;
  autoCommit?: boolean;
  sessionTimeout?: number;
  heartbeatInterval?: number;
}

export interface TopicConfig {
  topic: string;
  numPartitions?: number;
  replicationFactor?: number;
  configEntries?: Array<{
    name: string;
    value: string;
  }>;
}

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;
  private consumers: Map<string, Consumer> = new Map();
  private admin: Admin;
  private isConnected = false;
  @Inject('KAFKA_CONFIG') private readonly KAFKA_CONFIG: any;
  @Inject() private readonly sseService: SseService;

  async onModuleInit() {
    if (!this.KAFKA_CONFIG.KAFKA_ENABLED) {
      return;
    }
    // Default configuration - should be overridden by environment variables
    const config: KafkaConfig = {
      clientId: this.KAFKA_CONFIG.KAFKA_CLIENT_ID,
      brokers: this.KAFKA_CONFIG.KAFKA_BROKERS,
      ssl: this.KAFKA_CONFIG.KAFKA_SSL,
    };

    // Add SASL configuration if provided
    if (process.env.KAFKA_SASL_USERNAME && process.env.KAFKA_SASL_PASSWORD) {
      config.sasl = {
        mechanism: (process.env.KAFKA_SASL_MECHANISM as any) || 'plain',
        username: process.env.KAFKA_SASL_USERNAME,
        password: process.env.KAFKA_SASL_PASSWORD,
      };
    }

    this.kafka = new Kafka(config);
    this.producer = this.kafka.producer({
      createPartitioner: Partitioners.LegacyPartitioner,
    });
    this.admin = this.kafka.admin();
    await this.connect();
    // await this.createTopicIfNotExists({
    //   topic: this.KAFKA_CONFIG.KAFKA_TOPIC,
    //   numPartitions: 1, // Default partition count
    //   replicationFactor: 1, // Default replication factor
    //   configEntries: [], // No additional config entries by default
    // });
    await this.createConsumerGroupIfNotExists(
      `${SseEvent.MonitorReport}-group`
    );
    await this.consumeMessages(
      {
        topic: SseEvent.MonitorReport,
        groupId: `${SseEvent.MonitorReport}-group`,
        fromBeginning: false,
        autoCommit: true,
      },
      async (payload: EachMessagePayload) => {
        // Default message handler, can be overridden by user
        this.sseService.emit(
          SseEvent.MonitorReport,
          payload.message.value.toString()
        );
      }
    );
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  /**
   * Connect to Kafka cluster
   */
  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      await this.admin.connect();
      this.isConnected = true;
      this.logger.log('Successfully connected to Kafka cluster');
    } catch (error) {
      this.logger.error('Failed to connect to Kafka cluster', error);
      throw error;
    }
  }

  /**
   * Disconnect from Kafka cluster
   */
  async disconnect(): Promise<void> {
    try {
      // Disconnect all consumers
      for (const [groupId, consumer] of this.consumers) {
        await consumer.disconnect();
        this.logger.log(`Disconnected consumer for group: ${groupId}`);
      }
      this.consumers.clear();

      // Disconnect producer and admin
      await this.producer.disconnect();
      await this.admin.disconnect();
      this.isConnected = false;
      this.logger.log('Successfully disconnected from Kafka cluster');
    } catch (error) {
      this.logger.error('Error disconnecting from Kafka cluster', error);
      throw error;
    }
  }

  /**
   * Check if service is connected to Kafka
   */
  isKafkaConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Publish messages to a Kafka topic
   */
  async publishMessage(options: ProduceMessageOptions): Promise<any> {
    try {
      if (!this.isConnected) {
        throw new Error('Kafka service is not connected');
      }

      const result = await this.producer.send({
        topic: options.topic,
        messages: options.messages.map((msg) => ({
          key: msg.key,
          value: msg.value,
          partition: msg.partition,
          headers: msg.headers,
        })),
      });
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to publish messages to topic: ${options.topic}`,
        error
      );
      throw error;
    }
  }

  /**
   * Publish a single message to a Kafka topic
   */
  async publishSingleMessage(
    topic: string,
    message: string,
    key?: string,
    headers?: Record<string, string>
  ): Promise<void> {
    return this.publishMessage({
      topic,
      messages: [{ key, value: message, headers }],
    });
  }

  /**
   * Subscribe to a Kafka topic and consume messages
   */
  async consumeMessages(
    options: ConsumeMessageOptions,
    messageHandler: (payload: EachMessagePayload) => Promise<void>
  ): Promise<void> {
    try {
      if (!this.isConnected) {
        throw new Error('Kafka service is not connected');
      }

      const consumer = this.kafka.consumer({
        groupId: options.groupId,
        sessionTimeout: options.sessionTimeout || 30000,
        heartbeatInterval: options.heartbeatInterval || 3000,
      });

      await consumer.connect();
      await consumer.subscribe({
        topic: options.topic,
        fromBeginning: options.fromBeginning || false,
      });

      await consumer.run({
        autoCommit: options.autoCommit !== false,
        eachMessage: async (payload) => {
          try {
            await messageHandler(payload);
          } catch (error) {
            this.logger.error(
              `Error processing message from topic: ${payload.topic}`,
              error
            );
            throw error;
          }
        },
      });

      this.consumers.set(options.groupId, consumer);
      this.logger.log(
        `Started consuming messages from topic: ${options.topic} with group: ${options.groupId}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to start consuming messages from topic: ${options.topic}`,
        error
      );
      throw error;
    }
  }

  /**
   * Stop consuming messages for a specific consumer group
   */
  async stopConsumer(groupId: string): Promise<void> {
    try {
      const consumer = this.consumers.get(groupId);
      if (consumer) {
        await consumer.disconnect();
        this.consumers.delete(groupId);
        this.logger.log(`Stopped consumer for group: ${groupId}`);
      } else {
        this.logger.warn(`No consumer found for group: ${groupId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to stop consumer for group: ${groupId}`, error);
      throw error;
    }
  }

  /**
   * Create a new Kafka topic
   */
  async createTopicIfNotExists(config: TopicConfig): Promise<void> {
    try {
      if (!this.isConnected) {
        throw new Error('Kafka service is not connected');
      }

      // Check if topic already exists
      const existingTopics = await this.admin.listTopics();
      if (existingTopics.includes(config.topic)) {
        this.logger.log(
          `Topic ${config.topic} already exists, skipping creation`
        );
        return;
      }

      await this.admin.createTopics({
        topics: [
          {
            topic: config.topic,
            numPartitions: config.numPartitions || 1,
            replicationFactor: config.replicationFactor || 1,
            configEntries: config.configEntries || [],
          },
        ],
      });

      this.logger.log(`Successfully created topic: ${config.topic}`);
    } catch (error) {
      this.logger.error(`Failed to create topic: ${config.topic}`, error);
      throw error;
    }
  }

  /**
   * Delete a Kafka topic
   */
  async deleteTopic(topic: string): Promise<void> {
    try {
      if (!this.isConnected) {
        throw new Error('Kafka service is not connected');
      }

      await this.admin.deleteTopics({
        topics: [topic],
      });

      this.logger.log(`Successfully deleted topic: ${topic}`);
    } catch (error) {
      this.logger.error(`Failed to delete topic: ${topic}`, error);
      throw error;
    }
  }

  /**
   * List all topics in the Kafka cluster
   */
  async listTopics(): Promise<string[]> {
    try {
      if (!this.isConnected) {
        throw new Error('Kafka service is not connected');
      }

      const topics = await this.admin.listTopics();
      this.logger.log(`Found ${topics.length} topics in the cluster`);
      return topics;
    } catch (error) {
      this.logger.error('Failed to list topics', error);
      throw error;
    }
  }

  /**
   * Get metadata for specific topics
   */
  async getTopicMetadata(
    topics?: string[]
  ): Promise<{ topics: ITopicMetadata[] }> {
    try {
      if (!this.isConnected) {
        throw new Error('Kafka service is not connected');
      }

      const metadata = await this.admin.fetchTopicMetadata({ topics });
      this.logger.log(
        `Retrieved metadata for ${metadata.topics.length} topics`
      );
      return metadata;
    } catch (error) {
      this.logger.error('Failed to get topic metadata', error);
      throw error;
    }
  }

  /**
   * List all consumer groups
   */
  async listConsumerGroups(): Promise<{
    groups: Array<{ groupId: string; protocolType: string }>;
  }> {
    try {
      if (!this.isConnected) {
        throw new Error('Kafka service is not connected');
      }

      const groups = await this.admin.listGroups();
      this.logger.log(`Found ${groups.groups.length} consumer groups`);
      return groups;
    } catch (error) {
      this.logger.error('Failed to list consumer groups', error);
      throw error;
    }
  }

  /**
   * Get detailed information about specific consumer groups
   */
  async describeConsumerGroups(
    groupIds: string[]
  ): Promise<{ groups: GroupDescription[] }> {
    try {
      if (!this.isConnected) {
        throw new Error('Kafka service is not connected');
      }

      const groups = await this.admin.describeGroups(groupIds);
      this.logger.log(
        `Retrieved details for ${groups.groups.length} consumer groups`
      );
      return groups;
    } catch (error) {
      this.logger.error('Failed to describe consumer groups', error);
      throw error;
    }
  }

  /**
   * Get consumer group offsets
   */
  async getConsumerGroupOffsets(
    groupId: string,
    topics?: string[]
  ): Promise<any> {
    try {
      if (!this.isConnected) {
        throw new Error('Kafka service is not connected');
      }

      const offsets = await this.admin.fetchOffsets({
        groupId,
        topics,
      });

      this.logger.log(`Retrieved offsets for consumer group: ${groupId}`);
      return offsets;
    } catch (error) {
      this.logger.error(
        `Failed to get offsets for consumer group: ${groupId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Reset consumer group offsets
   */
  async resetConsumerGroupOffsets(
    groupId: string,
    topic: string,
    earliest = true
  ): Promise<void> {
    try {
      if (!this.isConnected) {
        throw new Error('Kafka service is not connected');
      }

      await this.admin.resetOffsets({
        groupId,
        topic,
        earliest,
      });

      this.logger.log(
        `Reset offsets for consumer group: ${groupId} on topic: ${topic}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to reset offsets for consumer group: ${groupId}`,
        error
      );
      throw error;
    }
  }

  /**
   * Create a consumer group if it doesn't exist
   */
  async createConsumerGroupIfNotExists(
    groupId: string,
    topic?: string
  ): Promise<void> {
    try {
      if (!this.isConnected) {
        throw new Error('Kafka service is not connected');
      }

      // Check if consumer group already exists
      const groups = await this.admin.listGroups();
      const existingGroup = groups.groups.find(
        (group) => group.groupId === groupId
      );

      if (existingGroup) {
        this.logger.log(
          `Consumer group ${groupId} already exists, skipping creation`
        );
        return;
      }

      // Consumer groups are created implicitly when consumers join them
      // We need to create a temporary consumer to initialize the group
      const tempConsumer = this.kafka.consumer({
        groupId: groupId,
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
      });

      await tempConsumer.connect();

      // If a topic is provided, subscribe to it to fully initialize the group
      if (topic) {
        await tempConsumer.subscribe({ topic, fromBeginning: false });

        // Run the consumer briefly to initialize the group
        await tempConsumer.run({
          eachMessage: async () => {
            // Empty handler - we just need to initialize the group
          },
        });

        // Wait a short time to ensure group is created
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Stop and disconnect the temporary consumer
        await tempConsumer.stop();
      }

      await tempConsumer.disconnect();

      this.logger.log(`Successfully created consumer group: ${groupId}`);
    } catch (error) {
      this.logger.error(`Failed to create consumer group: ${groupId}`, error);
      throw error;
    }
  }

  /**
   * Delete a consumer group
   */
  async deleteConsumerGroup(groupId: string): Promise<void> {
    try {
      if (!this.isConnected) {
        throw new Error('Kafka service is not connected');
      }

      await this.admin.deleteGroups([groupId]);
      this.logger.log(`Successfully deleted consumer group: ${groupId}`);
    } catch (error) {
      this.logger.error(`Failed to delete consumer group: ${groupId}`, error);
      throw error;
    }
  }

  /**
   * Get cluster information
   */
  async getClusterInfo(): Promise<any> {
    try {
      if (!this.isConnected) {
        throw new Error('Kafka service is not connected');
      }

      const metadata = await this.admin.fetchTopicMetadata();
      const groups = await this.admin.listGroups();

      return {
        topics: metadata.topics.length,
        consumerGroups: groups.groups.length,
        clusterId: 'kafka-cluster',
      };
    } catch (error) {
      this.logger.error('Failed to get cluster information', error);
      throw error;
    }
  }

  /**
   * Health check for Kafka connection
   */
  async healthCheck(): Promise<{ status: string; details: any }> {
    try {
      if (!this.isConnected) {
        return {
          status: 'unhealthy',
          details: { message: 'Not connected to Kafka cluster' },
        };
      }

      // Try to fetch metadata as a health check
      const metadata = await this.admin.fetchTopicMetadata();

      return {
        status: 'healthy',
        details: {
          topics: metadata.topics.length,
          connected: true,
        },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        details: { error: error.message },
      };
    }
  }
}
