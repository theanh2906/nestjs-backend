# RabbitMQ & STOMP Integration in NestJS

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
- **Automatic Reconnection:** STOMP client auto-reconnects on connection loss.
- **Configurable Credentials:** Uses NestJS `ConfigService` for endpoint and credential management.
- **Graceful Shutdown:** Cleans up connections and subscriptions on module destroy.

---

## Configuration

Add the following environment variables to your `.env` or configuration system:

```env
RABBITMQ_STOMP_URL=ws://localhost:15674/ws
RABBITMQ_STOMP_LOGIN=admin
RABBITMQ_STOMP_PASSCODE=admin
```

- `RABBITMQ_STOMP_URL`: WebSocket endpoint for RabbitMQ STOMP plugin.
- `RABBITMQ_STOMP_LOGIN` / `RABBITMQ_STOMP_PASSCODE`: STOMP credentials.

---

## Usage

### 1. Inject the Service

```typescript
import { RabbitmqService } from 'src/services/rabbitmq.service';

constructor(private readonly rabbitmqService: RabbitmqService) {}
```

### 2. AMQP Operations

#### Connect to RabbitMQ (AMQP)

```typescript
await this.rabbitmqService.connect('amqp://localhost');
```

#### Publish to a Queue

```typescript
await this.rabbitmqService.publishToQueue('my-queue', 'Hello, RabbitMQ!');
```

#### Consume from a Queue

```typescript
await this.rabbitmqService.consume('my-queue', (msg) => {
  console.log('Received:', msg.content.toString());
});
```

#### Disconnect

```typescript
await this.rabbitmqService.disconnect();
```

---

### 3. STOMP Operations

#### Publish a STOMP Message

```typescript
this.rabbitmqService.publishStomp('/queue/my-queue', 'Hello via STOMP!');
```

#### Subscribe to a STOMP Destination

```typescript
this.rabbitmqService.subscribeStomp('/queue/my-queue', (msg) => {
  console.log('STOMP message:', msg.body);
});
```

#### Unsubscribe

```typescript
this.rabbitmqService.unsubscribeStomp('/queue/my-queue');
```

---

## Lifecycle Management

- The service automatically initializes the STOMP client on module startup.
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
    await this.rabbitmqService.connect();
    await this.rabbitmqService.publishToQueue('jobs', 'Job started');
    this.rabbitmqService.subscribeStomp('/queue/updates', (msg) => {
      console.log('Live update:', msg.body);
    });
  }

  async onModuleDestroy() {
    await this.rabbitmqService.disconnect();
    this.rabbitmqService.unsubscribeStomp('/queue/updates');
  }
}
```

---

## Notes

- Ensure the RabbitMQ server has the STOMP and Web STOMP plugins enabled.
- Adjust credentials and endpoints as needed for your environment.
- For production, secure your RabbitMQ instance and credentials appropriately.

---

## References

- [RabbitMQ STOMP Plugin Documentation](https://www.rabbitmq.com/stomp.html)
- [amqplib (AMQP 0-9-1 library)](https://www.npmjs.com/package/amqplib)
- [@stomp/stompjs](https://stomp-js.github.io/stomp-websocket/codo/)

---
