import { Module } from '@nestjs/common';
import { AppGateway } from './app.gateway';
import { HttpModule } from '@nestjs/axios';
import { CacheInterceptor, CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { RateLimitGuards } from './guards/rate-limit.guards';
import { ConfigModule } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import multer from 'multer';
import { TerminusModule } from '@nestjs/terminus';
import * as services from './services';
import * as controllers from './controllers';
import * as admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';
import * as fs from 'node:fs';
import { google } from 'googleapis';
import * as process from 'node:process';

const MESSAGING_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const SCOPES = [MESSAGING_SCOPE];

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
    // ClientsModule.register([
    //   {
    //     name: 'QUEUE_SERVICE',
    //     transport: Transport.RMQ,
    //     options: {
    //       urls: [process.env.RABBITMQ_URL],
    //       queue: 'nestjs-backend',
    //       queueOptions: {
    //         durable: false,
    //       },
    //       credentials: {
    //         username: process.env.RABBITMQ_USERNAME,
    //         password: process.env.RABBITMQ_PASSWORD,
    //       },
    //     },
    //   },
    // ]),
  ],
  controllers: Object.values(controllers),
  providers: [
    AppGateway,
    ...Object.values(services),
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
            (await getDecodedContent('serviceAccountKey.b64')) as ServiceAccount
          ),
        });
      },
    },
    {
      provide: 'FIREBASE_SERVICE_ACCOUNT',
      useFactory: async () => {
        return await getDecodedContent('serviceAccountKey.b64');
      },
    },
    {
      provide: 'APP_SECRETS',
      useFactory: async () => {
        return await getAppSecrets();
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

const getDecodedContent = (filePath: string) => {
  return new Promise((resolve, reject) => {
    fs.readFile(`secrets/${filePath}`, 'utf8', (err, data) => {
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

const getAppSecrets = async () => {
  const files = fs.readdirSync('secrets');
  const result: { [key: string]: any } = {};
  for (const file of files) {
    const key = file.split('.')[0];
    Object.assign(result, { [key]: await getDecodedContent(file) });
  }
  return result;
};

const _getAccessToken = () => {
  return new Promise(async (resolve, reject) => {
    const serviceAccount = (await getDecodedContent(
      'serviceAccountKey.b64'
    )) as any;
    const jwtClient = new google.auth.JWT(
      serviceAccount.client_email,
      null,
      serviceAccount.private_key,
      SCOPES,
      null
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
