import {
  Inject,
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
} from '@nestjs/common';
import { BaseService } from '../shared/base.service';
import * as admin from 'firebase-admin';
import { v4 as uuid } from 'uuid';
import { Bucket } from '@google-cloud/storage';
import { UtilsService } from '../shared/utils.service';

@Injectable()
export class FirebaseService extends BaseService implements OnModuleInit {
  protected COLLECTION_NAME = '';
  @Inject('FIREBASE_ADMIN') protected readonly firebaseApp: admin.app.App;
  @Inject('FIREBASE_SERVICE_ACCOUNT') protected readonly serviceAccount: any;
  private database: admin.database.Database;
  private storage: admin.storage.Storage;
  private bucket: Bucket;
  private message: any;
  @Inject() private readonly utilsService: UtilsService;

  async fetchData(): Promise<any> {
    const snapshot = await this.database
      .ref(this.COLLECTION_NAME)
      .once('value');
    // this.appGateway.sendMessage('all-events', snapshot.val());
    return snapshot.val();
  }

  async modifyData(data: any): Promise<void> {
    await this.database.ref(this.COLLECTION_NAME + `/${uuid()}`).set(data);
  }

  async deleteData(id: string): Promise<any> {
    await this.database.ref(this.COLLECTION_NAME + `/${id}`).remove();
  }

  async uploadFilesToStorage(file: Express.Multer.File): Promise<string> {
    const fileName = file.originalname;
    const fileUpload = this.bucket.file(fileName);
    await fileUpload.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
      },
    });

    await fileUpload.makePublic();
    return fileUpload.publicUrl();
  }

  async getAllFiles() {
    const files = await this.bucket.getFiles({
      includeTrailingDelimiter: true,
      delimiter: '/',
    });
    return this.utilsService.formatStoragePayload(files);
  }

  async createFolder(folderName: string): Promise<string> {
    try {
      // Ensure the folder name ends with '/'
      const folderPath = folderName.endsWith('/')
        ? folderName
        : `${folderName}/`;

      // Placeholder file to create the folder
      const placeholderFile = `${folderPath}.keep`;

      // Upload an empty placeholder file
      const file = this.bucket.file(placeholderFile);
      await file.save('', {
        contentType: 'application/octet-stream', // Empty file content
        metadata: {
          description: 'Placeholder file to create a folder',
        },
      });
      return `Folder '${folderPath}' created successfully.`;
    } catch (_error) {
      throw new InternalServerErrorException(
        `Unable to create folder '${folderName}'.`
      );
    }
  }

  async deleteFiles(fileNames: string[]) {
    try {
      const deletePromises = fileNames.map((fileName) =>
        this.bucket.file(fileName).delete()
      );
      await Promise.all(deletePromises);
    } catch (_error) {
      throw new InternalServerErrorException(
        'Unable to delete one or more files'
      );
    }
  }

  onModuleInit(): any {
    this.database = this.firebaseApp.database();
    this.bucket = this.firebaseApp.storage().bucket();
    this.message = this.firebaseApp.messaging();
  }
}
