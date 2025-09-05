import { Body, Controller, Inject, Post } from '@nestjs/common';
import { NotificationsService } from '../services';

@Controller('/api/notifications')
export class NotificationsController {
  @Inject() notificationsService: NotificationsService;

  @Post('/subscribe')
  async subscribe(@Body() token: any) {
    console.log('Subscription received:', token);
    this.notificationsService.setToken(token.token);

    return { message: 'Subscription saved' };
  }

  @Post('/send')
  async sendPushNotification(@Body() payload: any) {
    console.log('Sending push notification:', payload);
    this.notificationsService.sendPushNotification(payload);
  }
}
