import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { AppGateway } from './app.gateway';
import { SystemService } from './services/system.service';
import { NotificationsService } from './services/notifications.service';

@Injectable()
export class AppService implements OnModuleInit {
  @Inject() private readonly gateway: AppGateway;
  @Inject() private readonly systemService: SystemService;
  @Inject() private readonly notificationsService: NotificationsService;

  startMonitoring() {
    setInterval(() => {
      this.gateway.sendMessage(
        'monitor',
        JSON.stringify(this.systemService.getMonitoringInfo()),
      );
    }, 2000);
  }

  checkForPushSubscription() {
    this.gateway.sendMessage(
      'pushSubscription',
      !!this.notificationsService.token,
    );
  }

  onModuleInit(): any {
    this.startMonitoring();
    this.checkForPushSubscription();
  }
}
