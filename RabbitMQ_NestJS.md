# RabbitMQ Integration in NestJS

This document describes the usage and design of the `RabbitmqService` for integrating RabbitMQ messaging (AMQP and STOMP/WebSocket) into a NestJS application.

---

## Overview

The `RabbitmqService` provides a unified interface for:

- **AMQP (Advanced Message Queuing Protocol):** Traditional RabbitMQ queue operations (publish/consume).
- **STOMP (Simple Text Oriented Messaging Protocol) over WebSocket:** Real-time messaging, suitable for web clients and event-driven architectures.

This service is suitable for applications requiring both backend queue processing and real-time WebSocket messaging.

---

## Features

- **AMQP Support:** Connect, publish, and consume messages from RabbitMQ queues.
- **STOMP/WebSocket Support:** Publish and subscribe to STOMP destinations for real-time communication.
- **Stream Queue Support:** Support for RabbitMQ stream queues with proper configuration.
- **Automatic Reconnection:** STOMP client auto-reconnects on connection loss.
- **Configurable Credentials:** Uses NestJS configuration for endpoint and credential management.
- **Graceful Shutdown:** Cleans up connections and subscriptions on module destroy.

---

## Configuration

Add the following environment variables to your `.env` or configuration system:

### STOMP Configuration

```env
RABBITMQ_STOMP_URL=ws://localhost:15674/ws
RABBITMQ_STOMP_LOGIN=admin
RABBITMQ_STOMP_PASSCODE=admin
```

- `RABBITMQ_STOMP_URL`: WebSocket endpoint for RabbitMQ STOMP plugin.
- `RABBITMQ_STOMP_LOGIN` / `RABBITMQ_STOMP_PASSCODE`: STOMP credentials.

### AMQP Configuration

```env
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=admin
RABBITMQ_PASSWORD=admin
RABBITMQ_AMQP_URL=amqp://admin:admin@localhost:5672
RABBITMQ_STREAM=nestjs-backend-stream
```

- `RABBITMQ_HOST`: RabbitMQ server hostname.
- `RABBITMQ_PORT`: RabbitMQ AMQP port (default: 5672).
- `RABBITMQ_USERNAME` / `RABBITMQ_PASSWORD`: AMQP credentials.
- `RABBITMQ_AMQP_URL`: Full AMQP URL (optional, will be constructed from other parameters if not provided).
- `RABBITMQ_STREAM`: Default stream queue name for stream operations.

---

## Usage

### 1. Inject the Service

```typescript
import { RabbitmqService } from 'src/services/rabbitmq.service';

constructor(private readonly rabbitmqService: RabbitmqService) {}
```

### 2. AMQP Operations

#### Set Protocol to AMQP

```typescript
this.rabbitmqService.protocol = 'AMQP'; // This is the default
```

#### Send Message to Stream Queue

```typescript
await this.rabbitmqService.sendToStream('my-stream-queue', { message: 'Hello, RabbitMQ Stream!' });
```

#### Subscribe to Stream Queue

```typescript
this.rabbitmqService.subscribeToStream('my-stream-queue', true); // true to start from first message
```

#### Send Message to Exchange

```typescript
this.rabbitmqService.sendToExchange('my-exchange', { message: 'Hello, RabbitMQ Exchange!' });
```

---

### 3. STOMP Operations

#### Set Protocol to STOMP

```typescript
this.rabbitmqService.protocol = 'STOMP';
```

#### Publish a STOMP Message

```typescript
this.rabbitmqService.publishStomp('/queue/my-queue', 'Hello via STOMP!');
```

#### Subscribe to a STOMP Destination

```typescript
this.rabbitmqService.subscribeStomp('/queue/my-queue', (msg) => {
  console.log('STOMP message:', msg.body);
  msg.ack(); // Acknowledge the message
});
```

#### Unsubscribe

```typescript
this.rabbitmqService.unsubscribeStomp('/queue/my-queue');
```

---

## Lifecycle Management

- The service automatically initializes the client (AMQP or STOMP) on module startup based on the selected protocol.
- All connections and subscriptions are gracefully closed on module shutdown.

---

## Example: Combined Usage

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { RabbitmqService } from './services/rabbitmq.service';

@Injectable()
export class ExampleService implements OnModuleInit, OnModuleDestroy {
  constructor(private readonly rabbitmqService: RabbitmqService) {}

  async onModuleInit() {
    // Using AMQP for backend processing
    this.rabbitmqService.protocol = 'AMQP';
    await this.rabbitmqService.sendToStream('jobs', { id: 123, action: 'process' });
    
    // Using STOMP for real-time updates
    this.rabbitmqService.protocol = 'STOMP';
    this.rabbitmqService.subscribeStomp('/queue/updates', (msg) => {
      console.log('Live update:', msg.body);
      msg.ack();
    });
  }

  async onModuleDestroy() {
    // Cleanup happens automatically in the service's onModuleDestroy
  }
}
```

---

## Stream Queues

RabbitMQ stream queues require special configuration:

```typescript
// Creating a stream queue with AMQP
await this.amqpChannel.assertQueue(stream, {
  durable: true,
  arguments: {
    'x-queue-type': 'stream',
    'x-max-length-bytes': 2000000000, // 2GB max size
  },
});

// Consuming from a stream queue
this.amqpChannel.consume(
  stream,
  (msg) => {
    // Process message
    this.amqpChannel.ack(msg); // Acknowledge the message
  },
  {
    noAck: false, // Manual acknowledgment
    exclusive: true, // Exclusive consumer
    arguments: {
      'x-stream-offset': fromFirst ? 'first' : 'next', // Start position
    },
  }
);
```

---

## Notes

- Ensure the RabbitMQ server has the STOMP and Web STOMP plugins enabled for STOMP functionality.
- For AMQP stream queues, RabbitMQ 3.9+ is required.
- Adjust credentials and endpoints as needed for your environment.
- For production, secure your RabbitMQ instance and credentials appropriately.

---

## References

- [RabbitMQ STOMP Plugin Documentation](https://www.rabbitmq.com/stomp.html)
- [RabbitMQ Streams Documentation](https://www.rabbitmq.com/streams.html)
- [amqplib (AMQP 0-9-1 library)](https://www.npmjs.com/package/amqplib)
- [@stomp/stompjs](https://stomp-js.github.io/stomp-websocket/codo/)

---