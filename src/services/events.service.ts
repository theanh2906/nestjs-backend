import { FirebaseService } from './firebase.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class EventsService extends FirebaseService {
  override COLLECTION_NAME = 'events';
}
