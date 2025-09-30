import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { FirebaseService } from './firebase.service';
import * as fs from 'node:fs';
import * as path from 'node:path';

@Injectable()
export class CronJobsService implements OnModuleInit {
  private readonly logger = new Logger(CronJobsService.name);
  @Inject() private readonly firebaseService: FirebaseService;

  // Trigger cron jobs when the app restarts
  async onModuleInit() {
    await this.backupFirebaseToVolume();
    await this.backupFirebaseStorageToVolume();
  }

  @Cron('0 */1 * * *', {
    name: 'backupFirebaseDatabase',
  })
  async backupFirebaseToVolume() {
    const environment = process.env.NODE_ENV || 'local';
    this.logger.log(
      `Starting Firebase DB backup in ${environment} environment...`
    );

    try {
      const backupPath = process.env.BACKUP_VOLUME_PATH || './data';

      await fs.promises.mkdir(backupPath, { recursive: true });

      const collections = await this.firebaseService.getAllCollections();
      this.logger.log(`Found ${collections.length} collections to backup`);

      const backupData: any = {};

      for (const collectionName of collections) {
        this.logger.log(`Backing up collection: ${collectionName}`);

        const snapshot =
          await this.firebaseService.getCollectionData(collectionName);
        const data = snapshot.val();

        if (data) {
          backupData[collectionName] = data;
          this.logger.log(
            `Collection ${collectionName} backed up successfully`
          );
        } else {
          this.logger.warn(`Collection ${collectionName} is empty, skipping`);
        }
      }

      const backupFile = path.join(backupPath, 'backup.json');
      await fs.promises.writeFile(
        backupFile,
        JSON.stringify(backupData, null, 2),
        'utf8'
      );

      this.logger.log(
        `Firebase DB backup completed successfully at: ${backupFile}`
      );
      this.logger.log(
        `Environment: ${environment}, Collections backed up: ${collections.length}`
      );
    } catch (error) {
      this.logger.error(
        `Firebase DB backup failed in ${environment} environment: ${error.message}`,
        error.stack
      );
    }
  }

  @Cron('0 */1 * * *', {
    name: 'backupFirebaseStorage',
  })
  async backupFirebaseStorageToVolume() {
    const environment = process.env.NODE_ENV || 'local';
    this.logger.log(
      `Starting Firebase Storage backup in ${environment} environment...`
    );

    try {
      const backupPath = process.env.BACKUP_VOLUME_PATH || './data';
      const storagePath = path.join(backupPath, 'storage');
      const metadataPath = path.join(storagePath, '.metadata.json');

      await fs.promises.mkdir(storagePath, { recursive: true });

      // Load existing metadata if it exists
      let existingMetadata: Record<
        string,
        { hash: string; lastModified: string; size: number }
      > = {};
      try {
        if (
          await fs.promises
            .access(metadataPath)
            .then(() => true)
            .catch(() => false)
        ) {
          const metadataContent = await fs.promises.readFile(
            metadataPath,
            'utf8'
          );
          existingMetadata = JSON.parse(metadataContent);
        }
      } catch (error) {
        this.logger.warn(`Could not load existing metadata: ${error.message}`);
      }

      // Get all files from Firebase Storage
      const [files] = await this.firebaseService['bucket'].getFiles();
      this.logger.log(`Found ${files.length} files in Firebase Storage`);

      const currentMetadata: Record<
        string,
        { hash: string; lastModified: string; size: number }
      > = {};
      const existingLocalFiles = new Set<string>();
      let downloadedCount = 0;
      let skippedCount = 0;
      let deletedCount = 0;

      // Process each file from Firebase Storage
      for (const file of files) {
        const fileName = file.name;
        const filePath = path.join(storagePath, fileName);

        // Skip folder placeholders
        if (fileName.endsWith('/.keep')) {
          continue;
        }

        existingLocalFiles.add(fileName);

        try {
          const [metadata] = await file.getMetadata();
          const cloudHash = metadata.md5Hash;
          const lastModified = metadata.updated || metadata.timeCreated;
          const size = parseInt(metadata.size.toString() || '0');

          currentMetadata[fileName] = {
            hash: cloudHash,
            lastModified,
            size,
          };

          // Check if file needs to be downloaded
          const existingFile = existingMetadata[fileName];
          const shouldDownload =
            !existingFile ||
            existingFile.hash !== cloudHash ||
            existingFile.lastModified !== lastModified ||
            existingFile.size !== size;

          if (shouldDownload) {
            // Create directory for file if needed
            const fileDir = path.dirname(filePath);
            await fs.promises.mkdir(fileDir, { recursive: true });

            // Download the file
            await file.download({ destination: filePath });
            downloadedCount++;
            this.logger.log(`Downloaded: ${fileName}`);
          } else {
            skippedCount++;
          }
        } catch (error) {
          this.logger.error(
            `Failed to process file ${fileName}: ${error.message}`
          );
        }
      }

      // Delete local files that no longer exist in Firebase Storage
      for (const localFileName of Object.keys(existingMetadata)) {
        if (!existingLocalFiles.has(localFileName)) {
          const localFilePath = path.join(storagePath, localFileName);
          try {
            await fs.promises.unlink(localFilePath);
            deletedCount++;
            this.logger.log(`Deleted local file: ${localFileName}`);
          } catch (error) {
            this.logger.warn(
              `Failed to delete local file ${localFileName}: ${error.message}`
            );
          }
        }
      }

      // Save updated metadata
      await fs.promises.writeFile(
        metadataPath,
        JSON.stringify(currentMetadata, null, 2),
        'utf8'
      );

      this.logger.log(
        `Firebase Storage backup completed successfully. Downloaded: ${downloadedCount}, Skipped: ${skippedCount}, Deleted: ${deletedCount}`
      );
      this.logger.log(
        `Environment: ${environment}, Storage path: ${storagePath}`
      );
    } catch (error) {
      this.logger.error(
        `Firebase Storage backup failed in ${environment} environment: ${error.message}`,
        error.stack
      );
    }
  }
}
