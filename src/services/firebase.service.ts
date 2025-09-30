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
import fs from 'node:fs';
import path from 'path';
import { FileService } from './file.service';

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
  @Inject() private readonly fileService: FileService;

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

  async handleFileSync(folderPath: string): Promise<void> {
    try {
      // Create a zip file from the folder
      const zipFilePath =
        await this.fileService.createZipFromFolder(folderPath);
      this.logger.log(`Zip file created at: ${zipFilePath}`);

      // Read the zip file from disk
      const fileInfo = await this.fileService.getFileInfo(zipFilePath);
      if (!fileInfo) {
        throw new Error('Failed to get zip file info');
      }

      // Read the file content
      const fileBuffer = await fs.promises.readFile(zipFilePath);

      // Create an Express.Multer.File object
      const multerFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: path.basename(zipFilePath),
        encoding: '7bit',
        mimetype: 'application/zip',
        buffer: fileBuffer,
        size: fileInfo.size,
        destination: '',
        filename: path.basename(zipFilePath),
        path: zipFilePath,
        stream: null,
      };

      // Upload the file to Firebase Storage
      const fileUrl = await this.uploadFilesToStorage(multerFile);
      this.logger.log(`File uploaded to Firebase Storage: ${fileUrl}`);

      // Clean up the local zip file
      await fs.promises.unlink(zipFilePath);
      this.logger.log(`Local zip file deleted: ${zipFilePath}`);
    } catch (error) {
      this.logger.error(`File sync error: ${error.message}`);
    }
  }

  async getAllCollections() {
    return this.database
      .ref()
      .once('value')
      .then((snapshot) => {
        const collections = [];
        snapshot.forEach((childSnapshot) => {
          collections.push(childSnapshot.key);
        });
        return collections;
      });
  }

  async getCollectionData(collectionName: string) {
    return this.database.ref(collectionName).once('value');
  }

  onModuleInit(): any {
    this.database = this.firebaseApp.database();
    this.bucket = this.firebaseApp.storage().bucket();
    this.message = this.firebaseApp.messaging();
  }
}
