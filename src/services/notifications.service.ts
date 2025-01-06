import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { BehaviorSubject } from 'rxjs';
import * as admin from 'firebase-admin';

@Injectable()
export class NotificationsService implements OnModuleInit {
  @Inject('FIREBASE_SERVICE_ACCOUNT')
  private readonly firebaseAdmin: admin.app.App;
  private messaging: admin.messaging.Messaging;
  private _subscription = new BehaviorSubject<PushSubscription>(null);

  get subscription() {
    return this._subscription.value;
  }

  set subscription(subscription: PushSubscription) {
    this._subscription.next(subscription);
  }

  private _token = new BehaviorSubject<string>('');

  get token() {
    return this._token.value;
  }

  set token(token: string) {
    this._token.next(token);
  }

  async sendPushNotification(payload: any) {
    try {
      console.log(this.token);
      const message = {
        token: this.token,
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
