import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { AppGateway } from './app.gateway';
import { NotificationsService, SystemService } from './services';

class RabbitMQService {}

@Injectable()
export class AppService implements OnModuleInit {
  @Inject() private readonly gateway: AppGateway;
  @Inject() private readonly systemService: SystemService;
  @Inject() private readonly notificationsService: NotificationsService;

  async startMonitoring() {
    setInterval(async () => {
      this.gateway.sendMessage(
        'monitor',
        JSON.stringify(await this.systemService.getMonitoringInfo())
      );
    }, 2000);
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
    await this.startMonitoring();
    this.checkForPushSubscription();
  }
}
