import { Body, Controller, Inject, Post } from '@nestjs/common';
import { NotificationsService } from '../services';

@Controller('/api/notifications')
export class NotificationsController {
  @Inject() notificationsService: NotificationsService;

  @Post('/subscribe')
  async subscribe(@Body() token: any) {
    console.log('Subscription received:', token);
    this.notificationsService.token = token.token;

    return { message: 'Subscription saved' };
  }
}
