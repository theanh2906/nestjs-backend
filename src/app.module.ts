import { Module } from '@nestjs/common';
import { AppGateway } from './app.gateway';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './app.controller';
import { CacheInterceptor, CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { RateLimitGuards } from './guards/rate-limit.guards';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import * as process from 'node:process';
import { MulterModule } from '@nestjs/platform-express';
import multer from 'multer';
import { TerminusModule } from '@nestjs/terminus';
import { UtilsService } from './shared/utils.service';
import { FileService } from './services/file.service';
import { FirebaseService } from './services/firebase.service';
import { FilesController } from './controllers/files.controller';
import { HealthController } from './health/health.controller';
import * as admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';
import { SystemService } from './services/system.service';
import * as fs from 'node:fs';
import { google } from 'googleapis';
import { MailerModule } from '@nestjs-modules/mailer';
import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter';
import { NotificationsService } from './services/notifications.service';

const MESSAGING_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const SCOPES = [MESSAGING_SCOPE];

const services = [
  AppService,
  UtilsService,
  FileService,
  FirebaseService,
  SystemService,
  NotificationsService,
];

const controllers = [AppController, FilesController, HealthController];

@Module({
  imports: [
    HttpModule,
    TerminusModule,
    CacheModule.register(),
    ConfigModule.forRoot({
      envFilePath: `src/environments/${process.env.NODE_ENV}.env`,
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    MulterModule.register({
      storage: multer.memoryStorage(),
    }),
    // DevtoolsModule.register({
    //   http: true,
    // }),
    MailerModule.forRoot({
      transport: {
        host: 'smtp.mailgun.org',
        secure: false,
        port: 587,
        auth: {
          user: 'no-reply@sandboxb495376bc5614fa0950dd0fba33239f2.mailgun.org',
          pass: 'BenNa1402*',
        },
      },
      defaults: {
        from: 'no-reply@sandboxb495376bc5614fa0950dd0fba33239f2.mailgun.org',
      },
      template: {
        dir: 'src/templates',
        adapter: new HandlebarsAdapter(),
        options: {
          strict: true,
        },
      },
    }),
  ],
  controllers: controllers,
  providers: [
    AppGateway,
    ...services,
    { provide: APP_INTERCEPTOR, useClass: CacheInterceptor },
    { provide: APP_GUARD, useClass: RateLimitGuards },
    {
      provide: 'FIREBASE_ADMIN',
      useFactory: async () => {
        return admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID,
          databaseURL: process.env.FIREBASE_DATABASE_URL,
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
          credential: admin.credential.cert(
            (await getCredential()) as ServiceAccount,
          ),
        });
      },
    },
    {
      provide: 'FIREBASE_SERVICE_ACCOUNT',
      useFactory: async () => {
        return await getCredential();
      },
    },
  ],
})
export class AppModule {
  /**
   * Config rate limit using cache. Should implement NestModule
   * @type any
   */
  // configure(consumer: MiddlewareConsumer) {
  //   consumer.apply(RateLimitMiddleware).forRoutes('*');
  // }
}

const getCredential = () => {
  return new Promise((resolve, reject) => {
    const filePath = 'serviceAccountKey.b64';
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) {
        console.error('Error reading the .b64 file:', err);
        reject();
      }
      try {
        const decodedContent = Buffer.from(data, 'base64');
        resolve(JSON.parse(decodedContent.toString()));
      } catch (err) {
        console.error('Error decoding the Base64 content:', err);
        reject();
      }
    });
  });
};

const getAccessToken = () => {
  return new Promise(async (resolve, reject) => {
    const serviceAccount = (await getCredential()) as any;
    const jwtClient = new google.auth.JWT(
      serviceAccount.client_email,
      null,
      serviceAccount.private_key,
      SCOPES,
      null,
    );
    jwtClient.authorize((err, tokens) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(tokens.access_token);
    });
  });
};
