import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { KafkaService } from './kafka.service';
import { SseService } from './sse.service';
import { SseEvent } from '../shared/types';

export interface KafkaPartitionInfo {
  partition: number;
  leader: number;
  replicas: number[];
  isr: number[];
  highWatermark?: number;
  lowWatermark?: number;
  size?: number;
  segmentCount?: number;
  lastModified?: Date;
}

export interface KafkaTopicInfo {
  name: string;
  partitions: KafkaPartitionInfo[];
  totalPartitions: number;
  replicationFactor: number;
  totalSize?: number;
  messageCount?: number;
  retentionMs?: number;
  retentionBytes?: number;
  cleanupPolicy?: string;
  compressionType?: string;
}

export interface KafkaConsumerGroupInfo {
  groupId: string;
  state: string;
  protocolType: string;
  protocol: string;
  members: Array<{
    memberId: string;
    clientId: string;
    clientHost: string;
    assignment: string[];
  }>;
  coordinator: {
    nodeId: number;
    host: string;
    port: number;
  };
  lag: number;
  offsets: Array<{
    topic: string;
    partition: number;
    offset: number;
    highWatermark: number;
    lag: number;
  }>;
}

export interface KafkaBrokerInfo {
  nodeId: number;
  host: string;
  port: number;
  rack?: string;
  isController: boolean;
  isAlive: boolean;
  version?: string;
  uptime?: number;
}

export interface KafkaClusterInfo {
  clusterId: string;
  controller: number;
  brokers: KafkaBrokerInfo[];
  totalBrokers: number;
  totalTopics: number;
  totalPartitions: number;
  totalConsumerGroups: number;
  version?: string;
  uptime?: number;
}

export interface KafkaMonitorReport {
  timestamp: Date;
  status: 'online' | 'offline' | 'degraded';
  cluster: KafkaClusterInfo;
  topics: KafkaTopicInfo[];
  consumerGroups: KafkaConsumerGroupInfo[];
  performance: {
    avgProduceTime: number;
    avgConsumeTime: number;
    messagesPerSecond: number;
    bytesPerSecond: number;
    errorRate: number;
  };
  errors: Array<{
    type: string;
    message: string;
    timestamp: Date;
  }>;
  alerts: Array<{
    level: 'warning' | 'error' | 'critical';
    message: string;
    timestamp: Date;
  }>;
}

@Injectable()
export class KafkaMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaMonitorService.name);
  private isMonitoring = false;
  private performanceMetrics = {
    produceTimeSamples: [] as number[],
    consumeTimeSamples: [] as number[],
    messageCount: 0,
    byteCount: 0,
    errorCount: 0,
    lastResetTime: new Date(),
  };

  constructor(
    private readonly kafkaService: KafkaService,
    private readonly sseService: SseService,
    @Inject('KAFKA_CONFIG') private readonly kafkaConfig: any
  ) {}

  async onModuleInit() {
    if (!this.kafkaConfig.KAFKA_ENABLED) {
      this.logger.log('Kafka monitoring disabled - KAFKA_ENABLED is false');
      return;
    }

    this.logger.log('Initializing Kafka monitoring service...');
    this.isMonitoring = true;

    // Start monitoring immediately, then continue with cron
    setTimeout(() => this.performMonitoringCheck(), 2000);
  }

  async onModuleDestroy() {
    this.isMonitoring = false;
    this.logger.log('Kafka monitoring service stopped');
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async performMonitoringCheck() {
    if (!this.isMonitoring || !this.kafkaConfig.KAFKA_ENABLED) {
      return;
    }

    try {
      this.logger.debug('Performing Kafka monitoring check...');
      const report = await this.generateMonitoringReport();

      // Send SSE event to frontend
      this.sseService.emit(
        SseEvent.MonitorReport,
        JSON.stringify({
          type: 'kafka-monitor',
          device_name: 'kafka-cluster',
          timestamp: new Date(),
          data: JSON.stringify(report),
        })
      );

      this.logger.debug('Kafka monitoring report sent via SSE');
    } catch (error) {
      this.logger.error('Failed to perform Kafka monitoring check', error);

      // Send error report
      const errorReport: Partial<KafkaMonitorReport> = {
        timestamp: new Date(),
        status: 'offline',
        errors: [
          {
            type: 'monitoring_error',
            message: error.message,
            timestamp: new Date(),
          },
        ],
        alerts: [
          {
            level: 'critical',
            message: `Kafka monitoring failed: ${error.message}`,
            timestamp: new Date(),
          },
        ],
      };

      this.sseService.emit(
        SseEvent.MonitorReport,
        JSON.stringify({
          type: 'kafka-monitor',
          device_name: 'kafka-cluster',
          timestamp: new Date(),
          data: JSON.stringify(errorReport),
        })
      );
    }
  }

  private async generateMonitoringReport(): Promise<KafkaMonitorReport> {
    const timestamp = new Date();
    let status: 'online' | 'offline' | 'degraded' = 'offline';
    const errors: Array<{ type: string; message: string; timestamp: Date }> =
      [];
    const alerts: Array<{
      level: 'warning' | 'error' | 'critical';
      message: string;
      timestamp: Date;
    }> = [];

    try {
      // Check if Kafka is connected
      if (!this.kafkaService.isKafkaConnected()) {
        throw new Error('Kafka service is not connected');
      }

      status = 'online';

      // Get cluster information
      const cluster = await this.getClusterInfo();

      // Get topics information
      const topics = await this.getTopicsInfo();

      // Get consumer groups information
      const consumerGroups = await this.getConsumerGroupsInfo();

      // Calculate performance metrics
      const performance = this.calculatePerformanceMetrics();

      // Generate alerts based on thresholds
      this.generateAlertsFromMetrics(
        topics,
        consumerGroups,
        performance,
        alerts
      );

      // Check for degraded status
      if (
        alerts.some(
          (alert) => alert.level === 'error' || alert.level === 'critical'
        )
      ) {
        status = 'degraded';
      }

      return {
        timestamp,
        status,
        cluster,
        topics,
        consumerGroups,
        performance,
        errors,
        alerts,
      };
    } catch (error) {
      errors.push({
        type: 'cluster_error',
        message: error.message,
        timestamp: new Date(),
      });

      alerts.push({
        level: 'critical',
        message: `Kafka cluster unavailable: ${error.message}`,
        timestamp: new Date(),
      });

      // Return minimal report with error information
      return {
        timestamp,
        status: 'offline',
        cluster: {
          clusterId: 'unknown',
          controller: -1,
          brokers: [],
          totalBrokers: 0,
          totalTopics: 0,
          totalPartitions: 0,
          totalConsumerGroups: 0,
        },
        topics: [],
        consumerGroups: [],
        performance: {
          avgProduceTime: 0,
          avgConsumeTime: 0,
          messagesPerSecond: 0,
          bytesPerSecond: 0,
          errorRate: 100,
        },
        errors,
        alerts,
      };
    }
  }

  private async getClusterInfo(): Promise<KafkaClusterInfo> {
    try {
      const metadata = await this.kafkaService.getTopicMetadata();
      const consumerGroups = await this.kafkaService.listConsumerGroups();

      // Extract broker information from metadata
      const brokers: KafkaBrokerInfo[] = [];
      const brokerSet = new Set<string>();

      metadata.topics.forEach((topic) => {
        topic.partitions.forEach((partition) => {
          const brokerKey = `${partition.leader}`;
          if (!brokerSet.has(brokerKey)) {
            brokerSet.add(brokerKey);
            brokers.push({
              nodeId: partition.leader,
              host: 'unknown', // KafkaJS doesn't provide broker host info in metadata
              port: 9092,
              isController: false, // We don't have controller info
              isAlive: true,
            });
          }
        });
      });

      return {
        clusterId: 'kafka-cluster', // Default cluster ID
        controller: brokers.length > 0 ? brokers[0].nodeId : -1,
        brokers,
        totalBrokers: brokers.length,
        totalTopics: metadata.topics.length,
        totalPartitions: metadata.topics.reduce(
          (sum, topic) => sum + topic.partitions.length,
          0
        ),
        totalConsumerGroups: consumerGroups.groups.length,
      };
    } catch (error) {
      this.logger.error('Failed to get cluster info', error);
      throw error;
    }
  }

  private async getTopicsInfo(): Promise<KafkaTopicInfo[]> {
    try {
      const metadata = await this.kafkaService.getTopicMetadata();
      const topics: KafkaTopicInfo[] = [];

      for (const topicMetadata of metadata.topics) {
        const partitions: KafkaPartitionInfo[] = topicMetadata.partitions.map(
          (partition) => ({
            partition: partition.partitionId,
            leader: partition.leader,
            replicas: partition.replicas,
            isr: partition.isr,
          })
        );

        topics.push({
          name: topicMetadata.name,
          partitions,
          totalPartitions: partitions.length,
          replicationFactor:
            partitions.length > 0 ? partitions[0].replicas.length : 1,
        });
      }

      return topics;
    } catch (error) {
      this.logger.error('Failed to get topics info', error);
      throw error;
    }
  }

  private async getConsumerGroupsInfo(): Promise<KafkaConsumerGroupInfo[]> {
    try {
      const groupsList = await this.kafkaService.listConsumerGroups();
      const consumerGroups: KafkaConsumerGroupInfo[] = [];

      if (groupsList.groups.length === 0) {
        return consumerGroups;
      }

      // Get detailed information for each consumer group
      const groupIds = groupsList.groups.map((group) => group.groupId);
      const groupsDetails =
        await this.kafkaService.describeConsumerGroups(groupIds);

      for (const groupDetail of groupsDetails.groups) {
        let totalLag = 0;
        const offsets: Array<{
          topic: string;
          partition: number;
          offset: number;
          highWatermark: number;
          lag: number;
        }> = [];

        try {
          // Try to get offsets for this group
          const groupOffsets = await this.kafkaService.getConsumerGroupOffsets(
            groupDetail.groupId
          );

          for (const topicOffset of groupOffsets) {
            for (const partitionOffset of topicOffset.partitions) {
              const lag = Math.max(
                0,
                (partitionOffset.high || 0) - (partitionOffset.offset || 0)
              );
              totalLag += lag;

              offsets.push({
                topic: topicOffset.topic,
                partition: partitionOffset.partition,
                offset: partitionOffset.offset || 0,
                highWatermark: partitionOffset.high || 0,
                lag,
              });
            }
          }
        } catch (error) {
          this.logger.debug(
            `Could not get offsets for group ${groupDetail.groupId}:`,
            error.message
          );
        }

        consumerGroups.push({
          groupId: groupDetail.groupId,
          state: groupDetail.state,
          protocolType: groupDetail.protocolType,
          protocol: groupDetail.protocol || 'unknown',
          members: groupDetail.members.map((member) => ({
            memberId: member.memberId,
            clientId: member.clientId,
            clientHost: member.clientHost,
            assignment: [], // Assignment info is not readily available in KafkaJS
          })),
          coordinator: {
            nodeId: -1, // Coordinator info is not available in KafkaJS describe response
            host: 'unknown',
            port: 9092,
          },
          lag: totalLag,
          offsets,
        });
      }

      return consumerGroups;
    } catch (error) {
      this.logger.error('Failed to get consumer groups info', error);
      throw error;
    }
  }

  private calculatePerformanceMetrics() {
    const now = new Date();
    const timeSinceReset =
      (now.getTime() - this.performanceMetrics.lastResetTime.getTime()) / 1000;

    const avgProduceTime =
      this.performanceMetrics.produceTimeSamples.length > 0
        ? this.performanceMetrics.produceTimeSamples.reduce(
            (a, b) => a + b,
            0
          ) / this.performanceMetrics.produceTimeSamples.length
        : 0;

    const avgConsumeTime =
      this.performanceMetrics.consumeTimeSamples.length > 0
        ? this.performanceMetrics.consumeTimeSamples.reduce(
            (a, b) => a + b,
            0
          ) / this.performanceMetrics.consumeTimeSamples.length
        : 0;

    const messagesPerSecond =
      timeSinceReset > 0
        ? this.performanceMetrics.messageCount / timeSinceReset
        : 0;
    const bytesPerSecond =
      timeSinceReset > 0
        ? this.performanceMetrics.byteCount / timeSinceReset
        : 0;
    const errorRate =
      this.performanceMetrics.messageCount > 0
        ? (this.performanceMetrics.errorCount /
            this.performanceMetrics.messageCount) *
          100
        : 0;

    // Reset metrics for next calculation
    this.resetPerformanceMetrics();

    return {
      avgProduceTime,
      avgConsumeTime,
      messagesPerSecond,
      bytesPerSecond,
      errorRate,
    };
  }

  private resetPerformanceMetrics() {
    this.performanceMetrics = {
      produceTimeSamples: [],
      consumeTimeSamples: [],
      messageCount: 0,
      byteCount: 0,
      errorCount: 0,
      lastResetTime: new Date(),
    };
  }

  private generateAlertsFromMetrics(
    topics: KafkaTopicInfo[],
    consumerGroups: KafkaConsumerGroupInfo[],
    performance: any,
    alerts: Array<{
      level: 'warning' | 'error' | 'critical';
      message: string;
      timestamp: Date;
    }>
  ) {
    const now = new Date();

    // Check for high consumer lag
    consumerGroups.forEach((group) => {
      if (group.lag > 10000) {
        alerts.push({
          level: 'critical',
          message: `Consumer group '${group.groupId}' has high lag: ${group.lag} messages`,
          timestamp: now,
        });
      } else if (group.lag > 1000) {
        alerts.push({
          level: 'warning',
          message: `Consumer group '${group.groupId}' has moderate lag: ${group.lag} messages`,
          timestamp: now,
        });
      }
    });

    // Check for topics with insufficient replication
    topics.forEach((topic) => {
      if (topic.replicationFactor < 2) {
        alerts.push({
          level: 'warning',
          message: `Topic '${topic.name}' has low replication factor: ${topic.replicationFactor}`,
          timestamp: now,
        });
      }
    });

    // Check performance metrics
    if (performance.errorRate > 5) {
      alerts.push({
        level: 'error',
        message: `High error rate: ${performance.errorRate.toFixed(2)}%`,
        timestamp: now,
      });
    }

    if (performance.avgProduceTime > 1000) {
      alerts.push({
        level: 'warning',
        message: `High average produce time: ${performance.avgProduceTime.toFixed(2)}ms`,
        timestamp: now,
      });
    }

    if (performance.avgConsumeTime > 1000) {
      alerts.push({
        level: 'warning',
        message: `High average consume time: ${performance.avgConsumeTime.toFixed(2)}ms`,
        timestamp: now,
      });
    }
  }

  // Methods to record performance metrics
  recordProduceTime(timeMs: number) {
    this.performanceMetrics.produceTimeSamples.push(timeMs);
    if (this.performanceMetrics.produceTimeSamples.length > 100) {
      this.performanceMetrics.produceTimeSamples.shift();
    }
  }

  recordConsumeTime(timeMs: number) {
    this.performanceMetrics.consumeTimeSamples.push(timeMs);
    if (this.performanceMetrics.consumeTimeSamples.length > 100) {
      this.performanceMetrics.consumeTimeSamples.shift();
    }
  }

  recordMessage(sizeBytes: number) {
    this.performanceMetrics.messageCount++;
    this.performanceMetrics.byteCount += sizeBytes;
  }

  recordError() {
    this.performanceMetrics.errorCount++;
  }

  // Manual trigger for testing
  async triggerMonitoringReport(): Promise<KafkaMonitorReport> {
    this.logger.log('Manually triggering Kafka monitoring report...');
    return await this.generateMonitoringReport();
  }
}
