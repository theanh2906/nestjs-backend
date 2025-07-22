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

/**
 * RabbitmqService
 *
 * Provides integration with RabbitMQ using both AMQP and STOMP protocols.
 * Supports queue publishing/consuming and STOMP over WebSocket messaging.
 */
@Injectable()
export class RabbitMQService implements OnModuleInit, OnModuleDestroy {
  protocol: 'AMQP' | 'STOMP' = 'AMQP'; // Default protocol
  @Inject('RABBITMQ_CONFIG') private readonly RABBITMQ_CONFIG: any;
  private client: Client;
  private amqpConnection: amqp.ChannelModel;
  private amqpChannel: Channel;
  private readonly logger = new Logger(RabbitMQService.name);
  private stompSubscriptions: Map<string, StompSubscription> = new Map();

  /**
   * Lifecycle hook: Initializes the RabbitMQ clients on module init.
   * You can choose which protocol to use (STOMP, AMQP, or both).
   */
  async onModuleInit() {
    if (this.protocol === 'STOMP') {
      // Initialize STOMP client
      this.initStomp();
      // Example of sending a message using STOMP
      this.sendToStream(
        this.RABBITMQ_CONFIG.RABBITMQ_STREAM,
        JSON.stringify({ hello: 'world from STOMP' })
      );
    }

    if (this.protocol === 'AMQP') {
      // Initialize AMQP client
      await this.initAmqpClient();
      // this.subscribeToStream(this.RABBITMQ_CONFIG.RABBITMQ_STREAM, true);
    }
  }

  /**
   * Lifecycle hook: Cleans up STOMP and AMQP connections on module destroy.
   */
  async onModuleDestroy() {
    // Clean up STOMP connections
    if (this.client) await this.client.deactivate();
    this.unsubscribeStomp('/queue/nestjs-backend');

    // Clean up AMQP connections
    if (this.amqpChannel) {
      try {
        await this.amqpChannel.close();
        this.logger.log('AMQP channel closed');
      } catch (error) {
        this.logger.error('Error closing AMQP channel: ' + error.message);
      }
    }

    if (this.amqpConnection) {
      try {
        await this.amqpConnection.close();
        this.logger.log('AMQP connection closed');
      } catch (error) {
        this.logger.error('Error closing AMQP connection: ' + error.message);
      }
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
    switch (this.protocol) {
      case 'STOMP':
        this.client.subscribe(
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
            'x-stream-offset': fromFirst ? 'first' : 'next', // Start from new messages
          }
        );
        this.logger.log(`Subscribed to stream: nestjs-backend-stream`);
        break;
      case 'AMQP':
        if (!this.amqpChannel) {
          throw new Error('AMQP channel not initialized');
        }

        this.amqpSubscribeStream(stream, fromFirst).subscribe({
          next: (_msg) => {},
        });

        this.logger.log(`Subscribed to AMQP stream: ${stream}`);
        break;
    }
  }

  async sendToStream(stream: string, message: any) {
    switch (this.protocol) {
      case 'STOMP':
        if (!this.client || !this.client.connected) {
          this.initStomp();
        }
        this.client.publish({
          destination: `/queue/${stream}`,
          body: JSON.stringify(message),
          headers: {
            'x-stream-offset': 'first', // Start from new messages
          },
        });
        this.logger.log(`Sent message to stream: ${message}`);
        break;
      case 'AMQP':
        if (!this.amqpChannel) {
          await this.initAmqpClient();
        }

        try {
          // Ensure the stream queue exists with the correct type
          await this.amqpChannel.assertQueue(stream, {
            durable: true,
            arguments: {
              'x-queue-type': 'stream',
              'x-max-age': '1Y',
              'x-max-length-bytes': 2000000000, // 2GB max size
            },
          });

          this.amqpChannel.sendToQueue(
            stream,
            Buffer.from(
              typeof message === 'string' ? message : JSON.stringify(message)
            ),
            { persistent: true } // Ensure message persistence
          );
        } catch (error) {
          this.logger.error(
            `Failed to send message to stream ${stream}: ${error.message}`
          );
          throw error;
        }
        break;
    }
  }

  sendToExchange(exchange: string, message: any) {
    switch (this.protocol) {
      case 'STOMP':
        if (!this.client || !this.client.connected) {
          throw new Error('STOMP client not connected');
        }
        this.client.publish({
          destination: `/exchange/${exchange}`,
          body: JSON.stringify(message),
          headers: {
            'content-type': 'application/json',
          },
        });
        this.logger.log(`Sent message to exchange: nestjs-backend`);
        break;
      case 'AMQP':
        if (!this.amqpChannel) {
          throw new Error('AMQP channel not initialized');
        }
        this.amqpChannel.publish(
          exchange,
          '',
          Buffer.from(JSON.stringify(message)),
          { persistent: true } // Ensure message persistence
        );
        this.logger.log(`Sent message to AMQP exchange: ${exchange}`);
        break;
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
