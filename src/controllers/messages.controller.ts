import { Body, Controller, Inject, Logger, Post } from '@nestjs/common';
import { KafkaService } from '../services';

@Controller('/api/messages')
export class MessagesController {
  protected readonly logger = new Logger(MessagesController.name);
  @Inject() private readonly kafkaService: KafkaService;
  @Post('publish')
  publishMessage(@Body() body: { topic: string; message: string }) {
    this.kafkaService.publishSingleMessage(body.topic, body.message);
  }
}
