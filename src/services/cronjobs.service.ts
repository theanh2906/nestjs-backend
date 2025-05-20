import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { FirebaseService } from './firebase.service';

// import { InjectFirebaseService, InjectMongoService, InjectMailService } from '...'; // adjust imports as needed

@Injectable()
export class CronJobsService {
  private readonly logger = new Logger(CronJobsService.name);
  @Inject() private readonly firebaseService: FirebaseService;
  // constructor(
  //   private readonly firebaseService: FirebaseService,
  //   private readonly mongoService: MongoService,
  //   private readonly mailService: MailService,
  // ) {}

  // Backup all Firebase Realtime Database collections to MongoDB daily at 2am
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async backupFirebaseToMongo() {
    this.logger.log('Starting Firebase DB backup to MongoDB...');
    // const collections = await this.firebaseService.getAllCollections();
    // for (const collectionName of collections) {
    //   const data = await this.firebaseService.getCollectionData(collectionName);
    //   await this.mongoService.saveBackup(collectionName, data);
    // }
    // this.logger.log('Firebase DB backup completed.');
  }

  // Send email notifications for upcoming events every day at 8am
  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async notifyUpcomingEvents() {
    this.logger.log('Checking for upcoming events...');
    // const events = await this.firebaseService.getUpcomingEvents();
    // for (const event of events) {
    //   await this.mailService.sendEventNotification(event);
    // }
    // this.logger.log('Event notifications sent.');
  }
}
