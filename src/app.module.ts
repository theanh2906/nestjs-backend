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
import { DevtoolsModule } from '@nestjs/devtools-integration';
import { TerminusModule } from '@nestjs/terminus';
import { EventsService } from './services/events.service';
import { UtilsService } from './shared/utils.service';
import { FileService } from './services/file.service';
import { FirebaseService } from './services/firebase.service';
import { NotesService } from './services/notes.service';
import { FilesController } from './controllers/files.controller';
import { HealthController } from './health/health.controller';
import * as admin from 'firebase-admin';
import { ServiceAccount } from 'firebase-admin';
import { SystemService } from './services/system.service';
import * as fs from 'node:fs';

const services = [
  AppService,
  EventsService,
  UtilsService,
  FileService,
  FirebaseService,
  NotesService,
  SystemService,
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
    DevtoolsModule.register({
      http: true,
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
