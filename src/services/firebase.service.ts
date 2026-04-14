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

/**
 * Service for interacting with Firebase services.
 */
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

  /**
   * Fetches data from the specified collection.
   * @returns The data from the collection.
   */
  async fetchData(): Promise<any> {
    const snapshot = await this.database
      .ref(this.COLLECTION_NAME)
      .once('value');
    // this.appGateway.sendMessage('all-events', snapshot.val());
    return snapshot.val();
  }

  /**
   * Modifies data in the specified collection.
   * @param data The data to add or modify.
   */
  async modifyData(data: any): Promise<void> {
    await this.database.ref(this.COLLECTION_NAME + `/${uuid()}`).set(data);
  }

  /**
   * Deletes data from the specified collection.
   * @param id The ID of the data to delete.
   */
  async deleteData(id: string): Promise<any> {
    await this.database.ref(this.COLLECTION_NAME + `/${id}`).remove();
  }

  /**
   * Uploads a file to Firebase Storage.
   * @param file The file to upload.
   * @returns The public URL of the uploaded file.
   */
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

  /**
   * Gets a list of all files in the Firebase Storage bucket.
   * @returns A list of files.
   */
  async getAllFiles() {
    const files = await this.bucket.getFiles({
      includeTrailingDelimiter: true,
      delimiter: '/',
    });
    return this.utilsService.formatStoragePayload(files);
  }

  /**
   * Creates a folder in Firebase Storage.
   * @param folderName The name of the folder to create.
   * @returns A success message.
   */
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

  /**
   * Deletes files from Firebase Storage.
   * @param fileNames The names of the files to delete.
   */
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

  /**
   * Synchronizes a local folder with Firebase Storage by creating a zip file and uploading it.
   * @param folderPath The path to the local folder to synchronize.
   */
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

  /**
   * Gets a list of all collections in the Firebase Realtime Database.
   * @returns A list of collection names.
   */
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

  /**
   * Gets the data for a specific collection.
   * @param collectionName The name of the collection.
   * @returns The data for the collection.
   */
  async getCollectionData(collectionName: string) {
    return this.database.ref(collectionName).once('value');
  }

  onModuleInit(): any {
    this.database = this.firebaseApp.database();
    this.bucket = this.firebaseApp.storage().bucket();
    this.message = this.firebaseApp.messaging();
  }
}
