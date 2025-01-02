import { Body, Controller, Get, Inject, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { SystemService } from './services/system.service';
import { SkipThrottle } from '@nestjs/throttler';
import { BaseController } from './shared/base.controller';
import { NotificationsService } from './services/notifications.service';

@Controller()
export class AppController extends BaseController {
  private readonly REQUEST_LIMIT = 10;
  private readonly appService: AppService;
  @Inject(CACHE_MANAGER) private cacheManager: Cache;
  @Inject() private readonly systemService: SystemService;
  @Inject() private readonly notificationsService: NotificationsService;

  @Get()
  @SkipThrottle()
  getHello(): any {
    return this.systemService.getMonitoringInfo();
  }

  @Post('send-notification')
  async sendNotification(
    @Body()
    body: {
      email: string;
      name: string;
    },
  ) {
    await this.notificationsService.sendPushNotification(body);

    return { message: 'Notification and email sent successfully' };
  }
}
