import { Inject, Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { BehaviorSubject } from 'rxjs';

@Injectable()
export class NotificationsService {
  @Inject('FIREBASE_SERVICE_ACCOUNT')
  private readonly firebaseAdmin: admin.app.App;
  private _subscription = new BehaviorSubject<PushSubscription>(null);

  get subscription() {
    return this._subscription.value;
  }

  set subscription(subscription: PushSubscription) {
    this._subscription.next(subscription);
  }

  async sendPushNotification(payload: any) {
    try {
      const messaging = this.firebaseAdmin.messaging();
      const message = {
        token: this.subscription.endpoint,
        notification: payload.notification,
      };
      const response = await messaging.send(message);
      console.log('Successfully sent message:', response);
      return response;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  }
}
