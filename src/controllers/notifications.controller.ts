import { Body, Controller, Inject, Post } from '@nestjs/common';
import { NotificationsService } from '../services';

/**
 * Controller for handling push notifications.
 */
@Controller('/api/notifications')
export class NotificationsController {
  @Inject() notificationsService: NotificationsService;

  /**
   * Subscribes a device to receive push notifications.
   * @param token The device token.
   * @returns A success message.
   */
  @Post('/subscribe')
  async subscribe(@Body() token: any) {
    console.log('Subscription received:', token);
    this.notificationsService.setToken(token.token);

    return { message: 'Subscription saved' };
  }

  /**
   * Sends a push notification.
   * @param payload The notification payload.
   */
  @Post('/send')
  async sendPushNotification(@Body() payload: any) {
    console.log('Sending push notification:', payload);
    await this.notificationsService.sendPushNotification(payload);
  }
}
