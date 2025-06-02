import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import * as amqp from 'amqplib';
import { WebSocket } from 'ws';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { ConfigService } from '@nestjs/config';

/**
 * RabbitmqService
 *
 * Provides integration with RabbitMQ using both AMQP and STOMP protocols.
 * Supports queue publishing/consuming and STOMP over WebSocket messaging.
 */
@Injectable()
export class RabbitmqService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.ChannelModel;
  private channel: amqp.Channel;
  private stompClient: Client;
  private readonly logger = new Logger(RabbitmqService.name);
  private stompSubscriptions: Map<string, StompSubscription> = new Map();

  @Inject()
  private readonly configService: ConfigService;

  /**
   * Lifecycle hook: Initializes the STOMP client on module init.
   */
  async onModuleInit() {
    // Optionally connect to AMQP if needed:
    // await this.connect();
    this.initStomp();
  }

  /**
   * Lifecycle hook: Cleans up STOMP and AMQP connections on module destroy.
   */
  async onModuleDestroy() {
    if (this.stompClient) await this.stompClient.deactivate();
    this.unsubscribeStomp('/queue/benna');
    await this.disconnect();
  }

  /**
   * Connects to RabbitMQ using AMQP protocol.
   * @param url RabbitMQ AMQP URL (default: amqp://localhost)
   */
  async connect(url: string = 'amqp://localhost') {
    this.connection = await amqp.connect(url);
    this.channel = await this.connection.createChannel();
    this.logger.log('Connected to RabbitMQ (AMQP)');
  }

  /**
   * Disconnects from RabbitMQ (AMQP).
   */
  async disconnect() {
    if (this.channel) {
      await this.channel.close();
      this.channel = undefined;
    }
    if (this.connection) {
      await this.connection.close();
      this.connection = undefined;
    }
    this.logger.log('Disconnected from RabbitMQ (AMQP)');
  }

  /**
   * Publishes a message to a RabbitMQ queue (AMQP).
   * @param queue Queue name
   * @param content Message content (string or Buffer)
   */
  async publishToQueue(queue: string, content: string | Buffer) {
    if (!this.channel) {
      throw new Error('AMQP channel is not initialized');
    }
    await this.channel.assertQueue(queue, { durable: true });
    const buffer = typeof content === 'string' ? Buffer.from(content) : content;
    this.channel.sendToQueue(queue, buffer);
    this.logger.log(`Published to queue "${queue}"`);
  }

  /**
   * Consumes messages from a RabbitMQ queue (AMQP).
   * @param queue Queue name
   * @param onMessage Callback for received messages
   */
  async consume(queue: string, onMessage: (msg: amqp.ConsumeMessage) => void) {
    if (!this.channel) {
      throw new Error('AMQP channel is not initialized');
    }
    await this.channel.assertQueue(queue, { durable: true });
    await this.channel.consume(queue, (msg) => {
      if (msg) {
        onMessage(msg);
        this.channel.ack(msg);
      }
    });
    this.logger.log(`Consuming from queue "${queue}"`);
  }

  // --- STOMP (WebSocket) ---

  /**
   * Publishes a message to a STOMP destination.
   * @param destination STOMP destination (e.g., /queue/your-queue)
   * @param body Message body (string)
   * @param headers Optional STOMP headers
   */
  publishStomp(destination: string, body: string, headers: any = {}) {
    if (!this.stompClient || !this.stompClient.connected) {
      throw new Error('STOMP client not connected');
    }
    this.stompClient.publish({ destination, body, headers });
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
    if (!this.stompClient || !this.stompClient.connected) {
      throw new Error('STOMP client not connected');
    }
    const sub = this.stompClient.subscribe(destination, callback, headers);
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

  /**
   * Initializes the STOMP client using configuration.
   */
  private initStomp() {
    const stompUrl = this.configService.get<string>('RABBITMQ_STOMP_URL');
    this.stompClient = new Client({
      brokerURL: stompUrl,
      connectHeaders: {
        login: this.configService.get<string>(
          'RABBITMQ_STOMP_USERNAME',
          'admin'
        ),
        passcode: this.configService.get<string>(
          'RABBITMQ_STOMP_PASSWORD',
          'admin'
        ),
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      webSocketFactory: () => new WebSocket(stompUrl),
    });

    this.stompClient.onConnect = () => {
      this.logger.log('STOMP connected');
      // Example subscription; customize as needed
      this.subscribeStomp('/queue/request', (msg) => {
        this.logger.log(`Received STOMP message: ${msg.body}`);
        msg.ack();
      });
    };

    this.stompClient.onStompError = (frame) => {
      this.logger.error('STOMP error: ' + frame.body);
    };

    this.stompClient.activate();
  }
}
