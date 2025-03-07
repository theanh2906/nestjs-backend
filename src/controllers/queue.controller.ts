import { Controller, Inject } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { AppGateway } from '../app.gateway';

@Controller()
export class QueueController {
  @Inject() private readonly gateway: AppGateway;
  @EventPattern('sendMessage')
  async handleMessage(@Payload() payload: any) {
    this.gateway.sendMessage('message', 'Message Queue');
    console.log('Received message:', payload);
  }
}
