import { Inject, Injectable, Logger } from '@nestjs/common';
import { WebSocket } from 'ws';
import { Client, StompSubscription } from '@stomp/stompjs';
import * as amqp from 'amqplib';
import { Channel } from 'amqplib';
import { Observable } from 'rxjs';

/**
 * RabbitHandler
 *
 * Provides low-level implementation for RabbitMQ operations using both AMQP and STOMP protocols.
 * Handles streams, queues, and exchanges separately.
 */
@Injectable()
export class RabbitMQClientService {
  @Inject('RABBITMQ_CONFIG') private readonly RABBITMQ_CONFIG: any;
  private readonly logger = new Logger(RabbitMQClientService.name);

  // AMQP connections
  private amqpConnection: amqp.ChannelModel;
  private amqpChannel: Channel;

  // STOMP client
  private stompClient: Client;
  private stompSubscriptions: Map<string, StompSubscription> = new Map();

  constructor() {
    this.logger.log('RabbitHandler initialized');
  }

  // -------------------- Stream Handlers --------------------

  /**
   * Subscribes to a RabbitMQ stream using the specified protocol
   * @param stream Stream name
   * @param fromFirst Whether to start from the first message
   * @param protocol Protocol to use (AMQP or STOMP)
   * @param callback Callback function for received messages
   */
  async subscribeToStream(
    stream: string,
    fromFirst: boolean = false,
    protocol: 'AMQP' | 'STOMP' = 'AMQP',
    callback?: (content: string) => void
  ): Promise<Observable<any> | StompSubscription> {
    if (protocol === 'STOMP') {
      return this.stompSubscribeToStream(stream, fromFirst, callback);
    } else {
      return this.amqpSubscribeToStream(stream, fromFirst, callback);
    }
  }

  /**
   * Sends a message to a RabbitMQ stream using the specified protocol
   * @param stream Stream name
   * @param message Message to send
   * @param protocol Protocol to use (AMQP or STOMP)
   */
  async sendToStream(
    stream: string,
    message: any,
    protocol: 'AMQP' | 'STOMP' = 'AMQP'
  ): Promise<void> {
    if (protocol === 'STOMP') {
      await this.stompSendToStream(stream, message);
    } else {
      await this.amqpSendToStream(stream, message);
    }
  }

  /**
   * Subscribes to a RabbitMQ stream using AMQP protocol
   * @param stream Stream name
   * @param fromFirst Whether to start from the first message
   * @param callback Callback function for received messages
   * @returns Observable that emits received messages
   */
  amqpSubscribeToStream(
    stream: string,
    fromFirst: boolean = false,
    callback?: (content: string) => void
  ): Observable<any> {
    return new Observable((observer) => {
      if (!this.amqpChannel) {
        this.initAmqpClient()
          .then(() => {
            this.setupAmqpStreamSubscription(
              stream,
              fromFirst,
              observer,
              callback
            );
          })
          .catch((err) => {
            this.logger.error(
              `Failed to initialize AMQP client: ${err.message}`
            );
            observer.error(err);
          });
      } else {
        this.setupAmqpStreamSubscription(stream, fromFirst, observer, callback);
      }
    });
  }

  /**
   * Sends a message to a RabbitMQ stream using AMQP protocol
   * @param stream Stream name
   * @param message Message to send
   */
  async amqpSendToStream(stream: string, message: any): Promise<void> {
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

      this.logger.log(`Sent message to AMQP stream: ${stream}`);
    } catch (error) {
      this.logger.error(
        `Failed to send message to stream ${stream}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Subscribes to a RabbitMQ queue using the specified protocol
   * @param queue Queue name
   * @param protocol Protocol to use (AMQP or STOMP)
   */
  subscribeToQueue(
    queue: string,
    protocol: 'AMQP' | 'STOMP' = 'AMQP'
  ): Observable<any> {
    if (protocol === 'STOMP') {
      return this.stompSubscribeToQueue(queue);
    } else {
      return this.amqpSubscribeToQueue(queue);
    }
  }

  /**
   * Sends a message to a RabbitMQ queue using the specified protocol
   * @param queue Queue name
   * @param message Message to send
   * @param protocol Protocol to use (AMQP or STOMP)
   */
  async sendToQueue(
    queue: string,
    message: any,
    protocol: 'AMQP' | 'STOMP' = 'AMQP'
  ): Promise<void> {
    if (protocol === 'STOMP') {
      await this.stompSendToQueue(queue, message);
    } else {
      await this.amqpSendToQueue(queue, message);
    }
  }

  /**
   * Subscribes to a RabbitMQ queue using AMQP protocol
   * @param queue Queue name
   * @param callback Callback function for received messages
   * @returns Observable that emits received messages
   */
  amqpSubscribeToQueue(
    queue: string,
    callback?: (content: string) => void
  ): Observable<any> {
    return new Observable((observer) => {
      if (!this.amqpChannel) {
        this.initAmqpClient()
          .then(() => {
            this.setupAmqpQueueSubscription(queue, observer, callback);
          })
          .catch((err) => {
            this.logger.error(
              `Failed to initialize AMQP client: ${err.message}`
            );
            observer.error(err);
          });
      } else {
        this.setupAmqpQueueSubscription(queue, observer, callback);
      }
    });
  }

  // -------------------- Queue Handlers --------------------

  /**
   * Sends a message to a RabbitMQ queue using AMQP protocol
   * @param queue Queue name
   * @param message Message to send
   */
  async amqpSendToQueue(queue: string, message: any): Promise<void> {
    if (!this.amqpChannel) {
      await this.initAmqpClient();
    }

    try {
      // Ensure the queue exists
      await this.amqpChannel.assertQueue(queue, {
        durable: true,
      });

      this.amqpChannel.sendToQueue(
        queue,
        Buffer.from(
          typeof message === 'string' ? message : JSON.stringify(message)
        ),
        { persistent: true } // Ensure message persistence
      );

      this.logger.log(`Sent message to AMQP queue: ${queue}`);
    } catch (error) {
      this.logger.error(
        `Failed to send message to queue ${queue}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Subscribes to a RabbitMQ exchange using the specified protocol
   * @param exchange Exchange name
   * @param routingKey Routing key
   * @param protocol Protocol to use (AMQP or STOMP)
   * @param callback Callback function for received messages
   */
  async subscribeToExchange(
    exchange: string,
    routingKey: string = '',
    protocol: 'AMQP' | 'STOMP' = 'AMQP',
    callback?: (content: string) => void
  ): Promise<Observable<any> | StompSubscription> {
    if (protocol === 'STOMP') {
      return this.stompSubscribeToExchange(exchange, routingKey, callback);
    } else {
      return this.amqpSubscribeToExchange(exchange, routingKey, callback);
    }
  }

  /**
   * Sends a message to a RabbitMQ exchange using the specified protocol
   * @param exchange Exchange name
   * @param message Message to send
   * @param routingKey Routing key
   * @param protocol Protocol to use (AMQP or STOMP)
   */
  async sendToExchange(
    exchange: string,
    message: any,
    routingKey: string = '',
    protocol: 'AMQP' | 'STOMP' = 'AMQP'
  ): Promise<void> {
    if (protocol === 'STOMP') {
      await this.stompSendToExchange(exchange, message, routingKey);
    } else {
      await this.amqpSendToExchange(exchange, message, routingKey);
    }
  }

  /**
   * Subscribes to a RabbitMQ exchange using AMQP protocol
   * @param exchange Exchange name
   * @param routingKey Routing key
   * @param callback Callback function for received messages
   * @returns Observable that emits received messages
   */
  amqpSubscribeToExchange(
    exchange: string,
    routingKey: string = '',
    callback?: (content: string) => void
  ): Observable<any> {
    return new Observable((observer) => {
      if (!this.amqpChannel) {
        this.initAmqpClient()
          .then(() => {
            this.setupAmqpExchangeSubscription(
              exchange,
              routingKey,
              observer,
              callback
            );
          })
          .catch((err) => {
            this.logger.error(
              `Failed to initialize AMQP client: ${err.message}`
            );
            observer.error(err);
          });
      } else {
        this.setupAmqpExchangeSubscription(
          exchange,
          routingKey,
          observer,
          callback
        );
      }
    });
  }

  /**
   * Sends a message to a RabbitMQ exchange using AMQP protocol
   * @param exchange Exchange name
   * @param message Message to send
   * @param routingKey Routing key
   */
  async amqpSendToExchange(
    exchange: string,
    message: any,
    routingKey: string = ''
  ): Promise<void> {
    if (!this.amqpChannel) {
      await this.initAmqpClient();
    }

    try {
      // Ensure the exchange exists
      await this.amqpChannel.assertExchange(exchange, 'topic', {
        durable: true,
      });

      this.amqpChannel.publish(
        exchange,
        routingKey,
        Buffer.from(
          typeof message === 'string' ? message : JSON.stringify(message)
        ),
        { persistent: true } // Ensure message persistence
      );

      this.logger.log(
        `Sent message to AMQP exchange: ${exchange} with routing key: ${routingKey}`
      );
    } catch (error) {
      this.logger.error(
        `Failed to send message to exchange ${exchange}: ${error.message}`
      );
      throw error;
    }
  }

  /**
   * Initializes the STOMP client
   */
  async initStomp(): Promise<void> {
    const stompUrl = this.RABBITMQ_CONFIG.RABBITMQ_STOMP_URL;
    this.stompClient = new Client({
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

    this.stompClient.onConnect = () => {
      this.logger.log('STOMP connected');
    };

    this.stompClient.onStompError = (frame) => {
      this.logger.error('STOMP error: ' + frame.body);
    };

    // Activate the client and wait for connection
    this.stompClient.activate();

    // Return a promise that resolves when connected
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('STOMP connection timeout'));
      }, 10000);

      const checkConnection = setInterval(() => {
        if (this.stompClient.connected) {
          clearTimeout(timeout);
          clearInterval(checkConnection);
          resolve();
        }
      }, 100);
    });
  }

  /**
   * Initializes the AMQP client
   */
  async initAmqpClient(): Promise<Channel> {
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

  // -------------------- Exchange Handlers --------------------

  /**
   * Closes all connections
   */
  async closeConnections(): Promise<void> {
    // Close STOMP connections
    if (this.stompClient) {
      try {
        await this.stompClient.deactivate();
        this.logger.log('STOMP client deactivated');
      } catch (error) {
        this.logger.error('Error deactivating STOMP client: ' + error.message);
      }
    }

    // Close AMQP connections
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

  /**
   * Subscribes to a RabbitMQ stream using STOMP protocol
   * @param stream Stream name
   * @param fromFirst Whether to start from the first message
   * @param callback Callback function for received messages
   * @returns StompSubscription
   */
  private stompSubscribeToStream(
    stream: string,
    fromFirst: boolean = false,
    callback?: (content: string) => void
  ): StompSubscription {
    if (!this.stompClient || !this.stompClient.connected) {
      throw new Error('STOMP client not connected');
    }

    const subscription = this.stompClient.subscribe(
      `/queue/${stream}`,
      (message) => {
        const content = message.body;
        const offset = message.headers['x-stream-offset'] || 'N/A';
        this.logger.log(`Received message: ${content} (offset: ${offset})`);
        message.ack(); // Manual acknowledgment

        if (callback) {
          callback(content);
        }
      },
      {
        ack: 'client-individual', // Manual acknowledgment
        'prefetch-count': '100', // Limit messages per fetch
        'x-queue-type': 'stream', // Declare as stream
        'x-stream-offset': fromFirst ? 'first' : 'next', // Start from new messages
      }
    );

    this.stompSubscriptions.set(`/queue/${stream}`, subscription);
    this.logger.log(`Subscribed to STOMP stream: ${stream}`);
    return subscription;
  }

  /**
   * Sends a message to a RabbitMQ stream using STOMP protocol
   * @param stream Stream name
   * @param message Message to send
   */
  private async stompSendToStream(stream: string, message: any): Promise<void> {
    if (!this.stompClient || !this.stompClient.connected) {
      await this.initStomp();
    }

    this.stompClient.publish({
      destination: `/queue/${stream}`,
      body: typeof message === 'string' ? message : JSON.stringify(message),
      headers: {
        'x-stream-offset': 'first', // Start from new messages
      },
    });

    this.logger.log(`Sent message to STOMP stream: ${stream}`);
  }

  /**
   * Sets up an AMQP stream subscription
   * @param stream Stream name
   * @param fromFirst Whether to start from the first message
   * @param observer Observable observer
   * @param callback Optional callback function
   */
  private setupAmqpStreamSubscription(
    stream: string,
    fromFirst: boolean,
    observer: any,
    callback?: (content: string) => void
  ): void {
    // Set prefetch count for stream queue - required for RabbitMQ stream queues
    this.amqpChannel.prefetch(100);
    this.amqpChannel
      .consume(
        stream,
        (msg) => {
          if (msg !== null) {
            const content = msg.content.toString();
            observer.next(content);
            this.logger.log(`Received AMQP message from stream: ${content}`);
            this.amqpChannel.ack(msg); // Acknowledge the message

            if (callback) {
              callback(content);
            }
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
        this.logger.error(`AMQP consume error: ${err.message}`);
        observer.error(err);
      });
  }

  /**
   * Subscribes to a RabbitMQ queue using STOMP protocol
   * @param queue Queue name
   * @param callback Callback function for received messages
   * @returns StompSubscription
   */
  private stompSubscribeToQueue(
    queue: string,
    callback?: (content: string) => void
  ): Observable<any> {
    return new Observable((observer) => {
      if (!this.stompClient || !this.stompClient.connected) {
        throw new Error('STOMP client not connected');
      }

      const subscription = this.stompClient.subscribe(
        `/queue/${queue}`,
        (message) => {
          const content = message.body;
          observer.next(content);
          this.logger.log(`Received message from queue ${queue}: ${content}`);
          message.ack(); // Manual acknowledgment

          if (callback) {
            callback(content);
          }
        },
        {
          ack: 'client-individual', // Manual acknowledgment
        }
      );

      this.stompSubscriptions.set(`/queue/${queue}`, subscription);
      this.logger.log(`Subscribed to STOMP queue: ${queue}`);
    });
  }

  /**
   * Sends a message to a RabbitMQ queue using STOMP protocol
   * @param queue Queue name
   * @param message Message to send
   */
  private async stompSendToQueue(queue: string, message: any): Promise<void> {
    if (!this.stompClient || !this.stompClient.connected) {
      await this.initStomp();
    }

    this.stompClient.publish({
      destination: `/queue/${queue}`,
      body: typeof message === 'string' ? message : JSON.stringify(message),
      headers: {
        'content-type': 'application/json',
      },
    });

    this.logger.log(`Sent message to STOMP queue: ${queue}`);
  }

  /**
   * Sets up an AMQP queue subscription
   * @param queue Queue name
   * @param observer Observable observer
   * @param callback Optional callback function
   */
  private setupAmqpQueueSubscription(
    queue: string,
    observer: any,
    callback?: (content: string) => void
  ): void {
    // Ensure the queue exists
    this.amqpChannel
      .assertQueue(queue, {
        durable: true,
      })
      .then(() => {
        this.amqpChannel
          .consume(
            queue,
            (msg) => {
              if (msg !== null) {
                const content = msg.content.toString();
                observer.next(content);
                this.logger.log(`Received AMQP message from queue: ${content}`);
                this.amqpChannel.ack(msg); // Acknowledge the message

                if (callback) {
                  callback(content);
                }
              }
            },
            {
              noAck: false, // Manual acknowledgment
            }
          )
          .catch((err) => {
            this.logger.error(`AMQP consume error: ${err.message}`);
            observer.error(err);
          });
      })
      .catch((err) => {
        this.logger.error(`Failed to assert queue ${queue}: ${err.message}`);
        observer.error(err);
      });
  }

  // -------------------- Connection Management --------------------

  /**
   * Subscribes to a RabbitMQ exchange using STOMP protocol
   * @param exchange Exchange name
   * @param routingKey Routing key
   * @param callback Callback function for received messages
   * @returns StompSubscription
   */
  private stompSubscribeToExchange(
    exchange: string,
    routingKey: string = '',
    callback?: (content: string) => void
  ): StompSubscription {
    if (!this.stompClient || !this.stompClient.connected) {
      throw new Error('STOMP client not connected');
    }

    const destination = `/exchange/${exchange}/${routingKey}`;
    const subscription = this.stompClient.subscribe(
      destination,
      (message) => {
        const content = message.body;
        this.logger.log(
          `Received message from exchange ${exchange}: ${content}`
        );
        message.ack(); // Manual acknowledgment

        if (callback) {
          callback(content);
        }
      },
      {
        ack: 'client-individual', // Manual acknowledgment
      }
    );

    this.stompSubscriptions.set(destination, subscription);
    this.logger.log(
      `Subscribed to STOMP exchange: ${exchange} with routing key: ${routingKey}`
    );
    return subscription;
  }

  /**
   * Sends a message to a RabbitMQ exchange using STOMP protocol
   * @param exchange Exchange name
   * @param message Message to send
   * @param routingKey Routing key
   */
  private async stompSendToExchange(
    exchange: string,
    message: any,
    routingKey: string = ''
  ): Promise<void> {
    if (!this.stompClient || !this.stompClient.connected) {
      await this.initStomp();
    }

    const destination = `/exchange/${exchange}/${routingKey}`;
    this.stompClient.publish({
      destination,
      body: typeof message === 'string' ? message : JSON.stringify(message),
      headers: {
        'content-type': 'application/json',
      },
    });

    this.logger.log(
      `Sent message to STOMP exchange: ${exchange} with routing key: ${routingKey}`
    );
  }

  /**
   * Sets up an AMQP exchange subscription
   * @param exchange Exchange name
   * @param routingKey Routing key
   * @param observer Observable observer
   * @param callback Optional callback function
   */
  private setupAmqpExchangeSubscription(
    exchange: string,
    routingKey: string,
    observer: any,
    callback?: (content: string) => void
  ): void {
    // Ensure the exchange exists
    this.amqpChannel
      .assertExchange(exchange, 'topic', {
        durable: true,
      })
      .then(() => {
        // Create a temporary queue for this subscription
        return this.amqpChannel.assertQueue('', {
          exclusive: true,
        });
      })
      .then((queueResult) => {
        const queueName = queueResult.queue;
        // Bind the queue to the exchange with the routing key
        return this.amqpChannel
          .bindQueue(queueName, exchange, routingKey)
          .then(() => queueName);
      })
      .then((queueName) => {
        // Consume messages from the queue
        this.amqpChannel
          .consume(
            queueName,
            (msg) => {
              if (msg !== null) {
                const content = msg.content.toString();
                observer.next(content);
                this.logger.log(
                  `Received AMQP message from exchange: ${content}`
                );
                this.amqpChannel.ack(msg); // Acknowledge the message

                if (callback) {
                  callback(content);
                }
              }
            },
            {
              noAck: false, // Manual acknowledgment
            }
          )
          .catch((err) => {
            this.logger.error(`AMQP consume error: ${err.message}`);
            observer.error(err);
          });
      })
      .catch((err) => {
        this.logger.error(
          `Failed to setup exchange subscription: ${err.message}`
        );
        observer.error(err);
      });
  }
}
