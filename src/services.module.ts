import { Module } from '@nestjs/common';
import { FirebaseService } from './services/firebase.service';
import { UtilsService } from './shared/utils.service';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { SystemService } from './services/system.service';
import { EventsService } from './services/events.service';
import * as admin from 'firebase-admin';
import { credential } from 'firebase-admin';
import process from 'node:process';
import serviceAccount from '../serviceAccountKey.json';
import { ServiceAccount } from 'firebase-admin/lib/app';
import { AppGateway } from './app.gateway';
import { NotesService } from './services/notes.service';
import { FileService } from './services/file.service';

const services = [
  FirebaseService,
  UtilsService,
  SystemService,
  EventsService,
  NotesService,
  FileService,
];

@Module({
  imports: [HttpModule, CacheModule.register()],
  providers: [
    ...services,
    {
      provide: 'FIREBASE_ADMIN',
      useFactory: () => {
        return admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID,
          databaseURL: process.env.FIREBASE_DATABASE_URL,
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
          credential: credential.cert(serviceAccount as ServiceAccount),
        });
      },
    },
    AppGateway,
  ],
  exports: [...services, 'FIREBASE_ADMIN'],
})
export class ServicesModule {}
