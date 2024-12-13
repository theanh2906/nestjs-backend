import { FirebaseService } from './firebase.service';

export class NotesService extends FirebaseService {
  override COLLECTION_NAME = 'notes';
}
