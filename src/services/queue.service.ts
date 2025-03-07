import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  ClientProxy,
  ClientProxyFactory,
  Transport,
} from '@nestjs/microservices';

@Injectable()
export class QueueService implements OnModuleInit {
  private client: ClientProxy;
  onModuleInit() {
    this.client = ClientProxyFactory.create({
      transport: Transport.RMQ,
      options: {
        urls: [process.env.RABBITMQ_URL],
        queue: 'backend',
        queueOptions: {
          durable: false,
        },
      },
    });
  }

  sendMessage(topic: string, data: any) {
    this.client.emit(topic, data);
  }
}
