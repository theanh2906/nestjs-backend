import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { AppGateway } from './app.gateway';
import {
  MessagesService,
  NotificationsService,
  SseService,
  SystemService,
} from './services';
import { SseEvent } from './shared/types';

@Injectable()
export class AppService implements OnModuleInit {
  @Inject() private readonly gateway: AppGateway;
  @Inject() private readonly systemService: SystemService;
  @Inject() private readonly notificationsService: NotificationsService;
  @Inject() private rabbitMQService: MessagesService;
  @Inject() private sseService: SseService;

  async startMonitoring() {
    setInterval(async () => {
      // Get monitoring info once to avoid duplicate API calls
      const monitoringInfo = await this.systemService.getMonitoringInfo();
      const monitoringData = JSON.stringify(monitoringInfo);

      // Send to WebSocket clients
      this.gateway.sendMessage('monitor', monitoringData);

      // Send to SSE clients
      this.sseService.emit(SseEvent.MonitorReport, monitoringData);

      // Send to RabbitMQ stream
      // this.rabbitMQService.sendToStream('monitor-report', monitoringData);
    }, 10000);
  }

  checkForPushSubscription() {
    setInterval(() => {
      this.gateway.sendMessage(
        'pushSubscription',
        !!this.notificationsService.token
      );
    }, 2000);
  }

  async onModuleInit() {
    console.log('AppService onModuleInit called');
    await this.startMonitoring();
    this.checkForPushSubscription();
  }
}
