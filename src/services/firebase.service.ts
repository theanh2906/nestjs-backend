import { Inject, Injectable } from '@nestjs/common';
import { BaseService } from '../shared/base.service';
import * as admin from 'firebase-admin';
import { v4 as uuid } from 'uuid';
import { AppGateway } from '../app.gateway';

@Injectable()
export class FirebaseService extends BaseService {
  protected COLLECTION_NAME = '';
  private database: admin.database.Database;
  private storage: admin.storage.Storage;
  private bucket: any;

  constructor(
    @Inject('FIREBASE_ADMIN') protected readonly firebaseApp: admin.app.App,
    private appGateway: AppGateway,
  ) {
    super();
    this.database = firebaseApp.database();
    this.bucket = firebaseApp
      .storage()
      .bucket('useful-tools-api.firebasestorage.app');
  }

  async fetchData(): Promise<any> {
    const snapshot = await this.database
      .ref(this.COLLECTION_NAME)
      .once('value');
    this.appGateway.sendMessage('all-events', snapshot.val());
    return snapshot.val();
  }

  async modifyData(data: any): Promise<void> {
    await this.database.ref(this.COLLECTION_NAME + `/${uuid()}`).set(data);
  }

  async deleteData(id: string): Promise<any> {
    await this.database.ref(this.COLLECTION_NAME + `/${id}`).remove();
  }

  async uploadFilesToStorage(file: Express.Multer.File): Promise<string> {
    const fileName = `${Date.now()}-${file.originalname}`;
    const fileUpload = this.bucket.file(fileName);
    await fileUpload.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    await fileUpload.makePublic();
    return fileUpload.publicUrl();
  }
}
