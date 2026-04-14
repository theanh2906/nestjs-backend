import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { BehaviorSubject } from 'rxjs';
import * as admin from 'firebase-admin';

/**
 * Service for handling push notifications.
 */
@Injectable()
export class NotificationsService implements OnModuleInit {
  @Inject('FIREBASE_SERVICE_ACCOUNT')
  private readonly firebaseAdmin: admin.app.App;
  private messaging: admin.messaging.Messaging;
  private _subscription = new BehaviorSubject<PushSubscription>(null);

  /**
   * The current push subscription.
   */
  get subscription() {
    return this._subscription.value;
  }

  set subscription(subscription: PushSubscription) {
    this._subscription.next(subscription);
  }

  private _token = new BehaviorSubject<string>('');

  /**
   * The current device token.
   */
  get token() {
    return this._token.value;
  }

  /**
   * Sets the device token.
   * @param token The device token.
   */
  setToken(token: string) {
    this._token.next(token);
  }

  /**
   * Sends a push notification.
   * @param payload The notification payload.
   * @returns The response from Firebase Cloud Messaging.
   */
  async sendPushNotification(payload: any) {
    try {
      const message: admin.messaging.Message = {
        token: payload.token || this.token,
        notification: payload.notification,
      };
      const response = await this.messaging.send(message);
      console.log('Successfully sent message:', response);
      return response;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }

  onModuleInit(): any {
    this.messaging = admin.messaging();
  }
}
