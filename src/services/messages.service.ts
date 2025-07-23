import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { WebSocket } from 'ws';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import * as amqp from 'amqplib';
import { Channel } from 'amqplib';
import { Observable } from 'rxjs';
import { RabbitMQClientService } from './rabbitmq-client.service';
import { FirebaseService } from './firebase.service';
import { MessageType, RabbitMessage } from '../shared/types';

/**
 * RabbitmqService
 *
 * Provides integration with RabbitMQ using both AMQP and STOMP protocols.
 * Supports queue publishing/consuming and STOMP over WebSocket messaging.
 */
@Injectable()
export class MessagesService implements OnModuleInit, OnModuleDestroy {
  protocol: 'AMQP' | 'STOMP' = 'AMQP'; // Default protocol
  @Inject('RABBITMQ_CONFIG') private readonly RABBITMQ_CONFIG: any;
  private client: Client;
  private amqpConnection: amqp.ChannelModel;
  private amqpChannel: Channel;
  private readonly logger = new Logger(MessagesService.name);
  private stompSubscriptions: Map<string, StompSubscription> = new Map();
  @Inject() private readonly rabbitHandler: RabbitMQClientService;
  @Inject() private readonly firebaseService: FirebaseService;

  /**
   * Lifecycle hook: Initializes the RabbitMQ clients on module init.
   * You can choose which protocol to use (STOMP, AMQP, or both).
   */
  async onModuleInit() {
    this.logger.log(
      `Initializing RabbitMQ service with protocol: ${this.protocol}`
    );

    // Send a test message to the stream
    await this.sendToStream(
      this.RABBITMQ_CONFIG.RABBITMQ_STREAM,
      JSON.stringify({ hello: 'world from RabbitMQService' })
    );

    // Subscribe to the stream
    this.subscribeToStream(this.RABBITMQ_CONFIG.RABBITMQ_STREAM, false);
    this.rabbitHandler
      .subscribeToQueue(this.RABBITMQ_CONFIG.RABBITMQ_QUEUE)
      .subscribe(async (content) => {
        const message = JSON.parse(content) as RabbitMessage;
        switch (message.type) {
          case MessageType.NOTE_SYNC:
            await this.firebaseService.handleFileSync(message.data.folder_path);
            break;
          default:
            break;
        }
        this.logger.log(`Received message from queue: ${message}`);
      });

    this.logger.log('RabbitMQ service initialized successfully');
  }

  /**
   * Lifecycle hook: Cleans up connections on module destroy.
   */
  async onModuleDestroy() {
    this.logger.log('Cleaning up RabbitMQ connections');

    try {
      // Clean up STOMP subscriptions
      this.unsubscribeStomp('/queue/nestjs-backend');

      // Close all connections through the handler
      await this.rabbitHandler.closeConnections();

      this.logger.log('RabbitMQ connections closed successfully');
    } catch (error) {
      this.logger.error(`Error closing RabbitMQ connections: ${error.message}`);
    }
  }

  // --- STOMP (WebSocket) ---

  /**
   * Publishes a message to a STOMP destination.
   * @param destination STOMP destination (e.g., /queue/your-queue)
   * @param body Message body (string)
   * @param headers Optional STOMP headers
   */
  publishStomp(destination: string, body: string, headers: any = {}) {
    if (!this.client || !this.client.connected) {
      throw new Error('STOMP client not connected');
    }
    this.client.publish({ destination, body, headers });
    this.logger.log(`Published STOMP message to "${destination}"`);
  }

  /**
   * Subscribes to a STOMP destination.
   * @param destination STOMP destination
   * @param callback Callback for received messages
   * @param headers Optional STOMP headers
   * @returns StompSubscription
   */
  subscribeStomp(
    destination: string,
    callback: (msg: IMessage) => void,
    headers: any = { ack: 'client' }
  ): StompSubscription {
    if (!this.client || !this.client.connected) {
      throw new Error('STOMP client not connected');
    }
    const sub = this.client.subscribe(destination, callback, headers);
    this.stompSubscriptions.set(destination, sub);
    this.logger.log(`Subscribed to STOMP destination "${destination}"`);
    return sub;
  }

  /**
   * Unsubscribes from a STOMP destination.
   * @param destination STOMP destination
   */
  unsubscribeStomp(destination: string) {
    const sub = this.stompSubscriptions.get(destination);
    if (sub) {
      sub.unsubscribe();
      this.stompSubscriptions.delete(destination);
      this.logger.log(`Unsubscribed from STOMP destination "${destination}"`);
    }
  }

  subscribeToStream(stream: string, fromFirst: boolean = false) {
    this.logger.log(`Delegating subscribeToStream to RabbitHandler: ${stream}`);

    return this.rabbitHandler.subscribeToStream(
      stream,
      fromFirst,
      this.protocol,
      (content) => {
        this.logger.log(`Received message from stream ${stream}: ${content}`);
      }
    );
  }

  async sendToStream(stream: string, message: any) {
    this.logger.log(`Delegating sendToStream to RabbitHandler: ${stream}`);

    try {
      await this.rabbitHandler.sendToStream(stream, message, this.protocol);
      this.logger.log(`Successfully sent message to stream: ${stream}`);
    } catch (error) {
      this.logger.error(
        `Failed to send message to stream ${stream}: ${error.message}`
      );
      throw error;
    }
  }

  async sendToExchange(
    exchange: string,
    message: any,
    routingKey: string = ''
  ) {
    this.logger.log(`Delegating sendToExchange to RabbitHandler: ${exchange}`);

    try {
      await this.rabbitHandler.sendToExchange(
        exchange,
        message,
        routingKey,
        this.protocol
      );
      this.logger.log(`Successfully sent message to exchange: ${exchange}`);
    } catch (error) {
      this.logger.error(
        `Failed to send message to exchange ${exchange}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Subscribes to a RabbitMQ stream queue using AMQP protocol.
   * Sets a prefetch count which is required for stream queues in RabbitMQ.
   * Without this setting, RabbitMQ will return a PRECONDITION_FAILED error.
   *
   * @param stream The name of the stream queue to subscribe to
   * @param fromFirst Whether to start consuming from the first message (true) or only new messages (false)
   * @returns Observable that emits received messages
   */
  amqpSubscribeStream(stream: string, fromFirst = false): Observable<any> {
    return new Observable((observer) => {
      // Set prefetch count for stream queue - required for RabbitMQ stream queues
      this.amqpChannel.prefetch(100);
      this.amqpChannel
        .consume(
          stream,
          (msg) => {
            if (msg !== null) {
              const content = msg.content.toString();
              console.log(content);
              observer.next(content);
              this.logger.log(`Received AMQP message: ${content}`);
              this.amqpChannel.ack(msg); // Acknowledge the message
            }
          },
          {
            noAck: false, // Manual acknowledgment
            exclusive: true, // Exclusive consumer
            arguments: {
              'x-stream-offset': fromFirst ? 'first' : 'next', // Start from new messages
            },
          }
        )
        .catch((err) => {
          this.logger.error('AMQP consume error: ' + err.message);
          observer.error(err);
        });
    });
  }

  /**
   * Initializes the STOMP client using configuration.
   */
  private initStomp() {
    const stompUrl = this.RABBITMQ_CONFIG.RABBITMQ_STOMP_URL;
    this.client = new Client({
      brokerURL: stompUrl,
      connectHeaders: {
        login: this.RABBITMQ_CONFIG.RABBITMQ_USERNAME,
        passcode: this.RABBITMQ_CONFIG.RABBITMQ_PASSWORD,
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      webSocketFactory: () => new WebSocket(stompUrl),
    });

    this.client.onConnect = () => {
      this.logger.log('STOMP connected');
      // Example subscription; customize as needed
      this.subscribeStomp('/queue/nestjs-backend', (msg) => {
        this.logger.log(`Received STOMP message: ${msg.body}`);
        msg.ack();
      });
      this.subscribeToStream(this.RABBITMQ_CONFIG.RABBITMQ_STREAM);
    };

    this.client.onStompError = (frame) => {
      this.logger.error('STOMP error: ' + frame.body);
    };

    this.client.activate();
  }

  /**
   * Initializes the AMQP client using configuration.
   * @returns Promise resolving to the AMQP channel
   */
  private async initAmqpClient(): Promise<Channel> {
    try {
      const amqpUrl =
        this.RABBITMQ_CONFIG.RABBITMQ_AMQP_URL ||
        `amqp://${this.RABBITMQ_CONFIG.RABBITMQ_USERNAME}:${this.RABBITMQ_CONFIG.RABBITMQ_PASSWORD}@${this.RABBITMQ_CONFIG.RABBITMQ_HOST}:${this.RABBITMQ_CONFIG.RABBITMQ_PORT}`;

      // Create a connection
      this.amqpConnection = await amqp.connect(amqpUrl);
      this.logger.log('AMQP connected');

      // Handle connection errors and closures
      this.amqpConnection.on('error', (err) => {
        this.logger.error('AMQP connection error: ' + err.message);
      });

      this.amqpConnection.on('close', () => {
        this.logger.warn('AMQP connection closed');
      });

      // Create a channel
      this.amqpChannel = await this.amqpConnection.createChannel();

      // Handle channel errors
      this.amqpChannel.on('error', (err) => {
        this.logger.error('AMQP channel error: ' + err.message);
      });

      this.amqpChannel.on('close', () => {
        this.logger.warn('AMQP channel closed');
      });

      return this.amqpChannel;
    } catch (error) {
      this.logger.error('Failed to initialize AMQP client: ' + error.message);
      throw error;
    }
  }
}
