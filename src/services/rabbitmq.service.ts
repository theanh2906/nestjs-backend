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
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  private connection: amqp.ChannelModel;
  private channel: amqp.Channel;
  private stompClient: Client;
  private readonly logger = new Logger(RabbitMQService.name);
  private stompSubscriptions: Map<string, StompSubscription> = new Map();

  @Inject()
  private readonly configService: ConfigService;

  /**
   * Lifecycle hook: Initializes the STOMP client on module init.
   */
  async onModuleInit() {
    // Optionally connect to AMQP if needed:
    // await this.connect('amqp://localhost:5672');
    this.initStomp();
  }

  /**
   * Lifecycle hook: Cleans up STOMP and AMQP connections on module destroy.
   */
  async onModuleDestroy() {
    if (this.stompClient) await this.stompClient.deactivate();
    this.unsubscribeStomp('/queue/nestjs-backend');
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

  subscribeToStream(stream: string) {
    this.stompClient.subscribe(
      `/queue/${stream}`,
      (message) => {
        const content = message.body;
        const offset = message.headers['x-stream-offset'] || 'N/A';
        this.logger.log(`Received message: ${content} (offset: ${offset})`);
        message.ack(); // Manual acknowledgment
      },
      {
        ack: 'client-individual', // Manual acknowledgment
        'prefetch-count': '100', // Limit messages per fetch
        'x-queue-type': 'stream', // Declare as stream
        'x-stream-offset': 'first', // Start from new messages
      }
    );
    this.logger.log(`Subscribed to stream: nestjs-backend-stream`);
  }

  sendToStream(stream: string, message: any) {
    if (!this.stompClient || !this.stompClient.connected) {
      throw new Error('STOMP client not connected');
    }
    this.stompClient.publish({
      destination: `/queue/${stream}`,
      body: JSON.stringify(message),
      headers: {
        'x-stream-offset': 'first', // Start from new messages
      },
    });
    this.logger.log(`Sent message to stream: ${message}`);
  }

  sendToExchange(exchange: string, message: any) {
    if (!this.stompClient || !this.stompClient.connected) {
      throw new Error('STOMP client not connected');
    }
    this.stompClient.publish({
      destination: `/exchange/${exchange}`,
      body: JSON.stringify(message),
      headers: {
        'content-type': 'application/json',
      },
    });
    this.logger.log(`Sent message to exchange: nestjs-backend`);
  }

  /**
   * Initializes the STOMP client using configuration.
   */
  private initStomp() {
    const stompUrl = this.configService.get<string>('RABBITMQ_STOMP_URL');
    this.stompClient = new Client({
      brokerURL: stompUrl,
      connectHeaders: {
        login: this.configService.get<string>('RABBITMQ_USERNAME'),
        passcode: this.configService.get<string>('RABBITMQ_PASSWORD'),
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      webSocketFactory: () => new WebSocket(stompUrl),
    });

    this.stompClient.onConnect = () => {
      this.logger.log('STOMP connected');
      // Example subscription; customize as needed
      this.subscribeStomp('/queue/nestjs-backend', (msg) => {
        this.logger.log(`Received STOMP message: ${msg.body}`);
        msg.ack();
      });
      this.subscribeToStream(this.configService.get<string>('RABBITMQ_STREAM'));
      this.sendToStream(
        this.configService.get<string>('RABBITMQ_STREAM'),
        JSON.stringify({ hello: 'world' })
      );
    };

    this.stompClient.onStompError = (frame) => {
      this.logger.error('STOMP error: ' + frame.body);
    };

    this.stompClient.activate();
  }
}
