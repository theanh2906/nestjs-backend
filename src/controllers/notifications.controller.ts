import { Body, Controller, Inject, Post } from '@nestjs/common';
import { NotificationsService } from '../services/notifications.service';

@Controller('/api/notifications')
export class NotificationsController {
  @Inject() notificationsService: NotificationsService;

  @Post('subscribe')
  async subscribe(@Body() subscription: PushSubscription) {
    console.log('Subscription received:', subscription);
    this.notificationsService.subscription = subscription;

    return { message: 'Subscription saved' };
  }
}
