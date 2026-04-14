import {
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { BaseService } from '../shared/base.service';
import { FirebaseService } from './firebase.service';
import { MongoDBService } from './mongodb.service';

export interface MigrationProgress {
  collection: string;
  total: number;
  migrated: number;
  failed: number;
  errors: string[];
}

/**
 * Service for migrating data from Firebase to MongoDB.
 */
@Injectable()
export class MigrationService extends BaseService {
  @Inject() private readonly firebaseService: FirebaseService;
  @Inject() private readonly mongodbService: MongoDBService;

  /**
   * Migrates a single collection from Firebase to MongoDB.
   * @param collectionName The name of the collection to migrate.
   * @param options The options for the migration.
   * @returns The progress of the migration.
   */
  async migrateCollection(
    collectionName: string,
    options: {
      preserveIds?: boolean;
      batchSize?: number;
      onProgress?: (progress: MigrationProgress) => void;
    } = {}
  ): Promise<MigrationProgress> {
    const { preserveIds = true, batchSize = 100, onProgress } = options;

    const progress: MigrationProgress = {
      collection: collectionName,
      total: 0,
      migrated: 0,
      failed: 0,
      errors: [],
    };

    try {
      this.logger.log(`Starting migration for collection: ${collectionName}`);

      // Fetch data from Firebase
      const firebaseSnapshot =
        await this.firebaseService.getCollectionData(collectionName);
      const firebaseData = firebaseSnapshot.val();

      if (!firebaseData) {
        this.logger.warn(`No data found in Firebase for ${collectionName}`);
        return progress;
      }

      // Convert Firebase data to array
      const entries = Object.entries(firebaseData);
      progress.total = entries.length;

      this.logger.log(
        `Found ${progress.total} documents in Firebase ${collectionName}`
      );

      // Process in batches
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);

        for (const [key, value] of batch) {
          try {
            const id = preserveIds ? key : undefined;
            await this.mongodbService.modifyData(collectionName, value, id);
            progress.migrated++;
          } catch (error) {
            progress.failed++;
            progress.errors.push(`Failed to migrate ${key}: ${error.message}`);
            this.logger.error(
              `Error migrating document ${key}: ${error.message}`
            );
          }
        }

        // Report progress
        if (onProgress) {
          onProgress({ ...progress });
        }

        this.logger.log(
          `Progress: ${progress.migrated}/${progress.total} documents migrated`
        );
      }

      this.logger.log(
        `Migration completed for ${collectionName}. Success: ${progress.migrated}, Failed: ${progress.failed}`
      );

      return progress;
    } catch (error) {
      this.logger.error(
        `Migration failed for ${collectionName}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to migrate collection ${collectionName}`
      );
    }
  }

  /**
   * Migrates all collections from Firebase to MongoDB.
   * @param options The options for the migration.
   * @returns A list of migration progress objects for each collection.
   */
  async migrateAllCollections(
    options: {
      preserveIds?: boolean;
      batchSize?: number;
      excludeCollections?: string[];
      onProgress?: (collection: string, progress: MigrationProgress) => void;
    } = {}
  ): Promise<MigrationProgress[]> {
    const { excludeCollections = [], onProgress } = options;

    try {
      this.logger.log(
        'Starting full database migration from Firebase to MongoDB'
      );

      // Get all collections from Firebase
      const collections = await this.firebaseService.getAllCollections();
      const collectionsToMigrate = collections.filter(
        (col) => !excludeCollections.includes(col)
      );

      this.logger.log(
        `Found ${collectionsToMigrate.length} collections to migrate`
      );

      const results: MigrationProgress[] = [];

      // Migrate each collection
      for (const collection of collectionsToMigrate) {
        const progress = await this.migrateCollection(collection, {
          ...options,
          onProgress: onProgress ? (p) => onProgress(collection, p) : undefined,
        });
        results.push(progress);
      }

      // Summary
      const totalMigrated = results.reduce((sum, r) => sum + r.migrated, 0);
      const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

      this.logger.log(
        `Full migration completed. Total migrated: ${totalMigrated}, Total failed: ${totalFailed}`
      );

      return results;
    } catch (error) {
      this.logger.error(`Full migration failed: ${error.message}`);
      throw new InternalServerErrorException(
        'Failed to migrate all collections'
      );
    }
  }

  /**
   * Verifies the migration of a collection by comparing the data in Firebase and MongoDB.
   * @param collectionName The name of the collection to verify.
   * @returns The result of the verification.
   */
  async verifyMigration(collectionName: string): Promise<{
    isValid: boolean;
    firebaseCount: number;
    mongodbCount: number;
    missingInMongoDB: string[];
    errors: string[];
  }> {
    const result = {
      isValid: true,
      firebaseCount: 0,
      mongodbCount: 0,
      missingInMongoDB: [],
      errors: [],
    };

    try {
      this.logger.log(`Verifying migration for collection: ${collectionName}`);

      // Get Firebase data
      const firebaseSnapshot =
        await this.firebaseService.getCollectionData(collectionName);
      const firebaseData = firebaseSnapshot.val();

      if (!firebaseData) {
        result.errors.push('No data found in Firebase');
        result.isValid = false;
        return result;
      }

      const firebaseKeys = Object.keys(firebaseData);
      result.firebaseCount = firebaseKeys.length;

      // Get MongoDB data
      const mongodbData = await this.mongodbService.fetchData(collectionName);
      const mongodbKeys = Object.keys(mongodbData);
      result.mongodbCount = mongodbKeys.length;

      // Check for missing documents
      for (const key of firebaseKeys) {
        if (!mongodbKeys.includes(key)) {
          result.missingInMongoDB.push(key);
          result.isValid = false;
        }
      }

      if (result.isValid) {
        this.logger.log(
          `Verification successful for ${collectionName}. All ${result.firebaseCount} documents are present in MongoDB.`
        );
      } else {
        this.logger.warn(
          `Verification failed for ${collectionName}. ${result.missingInMongoDB.length} documents are missing in MongoDB.`
        );
      }

      return result;
    } catch (error) {
      result.errors.push(`Verification error: ${error.message}`);
      result.isValid = false;
      this.logger.error(
        `Verification failed for ${collectionName}: ${error.message}`
      );
      return result;
    }
  }

  /**
   * Rolls back the migration of a collection by deleting the data from MongoDB.
   * @param collectionName The name of the collection to roll back.
   * @returns True if the rollback was successful, false otherwise.
   */
  async rollbackMigration(collectionName: string): Promise<boolean> {
    try {
      this.logger.log(
        `Rolling back migration for collection: ${collectionName}`
      );
      const dropped = await this.mongodbService.dropCollection(collectionName);

      if (dropped) {
        this.logger.log(`Successfully rolled back ${collectionName}`);
      } else {
        this.logger.warn(
          `Collection ${collectionName} was not found in MongoDB`
        );
      }

      return dropped;
    } catch (error) {
      this.logger.error(
        `Rollback failed for ${collectionName}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to rollback migration for ${collectionName}`
      );
    }
  }

  /**
   * Exports a Firebase collection to a JSON object.
   * @param collectionName The name of the collection to export.
   * @returns The exported data.
   */
  async exportFirebaseToJSON(collectionName: string): Promise<any> {
    try {
      this.logger.log(`Exporting Firebase data for ${collectionName}`);
      const snapshot =
        await this.firebaseService.getCollectionData(collectionName);
      return snapshot.val();
    } catch (error) {
      this.logger.error(
        `Export failed for ${collectionName}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to export Firebase data for ${collectionName}`
      );
    }
  }

  /**
   * Imports JSON data into a MongoDB collection.
   * @param collectionName The name of the collection.
   * @param data The data to import.
   * @returns The number of imported documents.
   */
  async importJSONToMongoDB(
    collectionName: string,
    data: any
  ): Promise<number> {
    try {
      this.logger.log(`Importing JSON data to MongoDB ${collectionName}`);

      // Convert object to array of documents
      const documents = Object.entries(data).map(([id, value]) => ({
        _id: id,
        ...(value as any),
      }));

      const count = await this.mongodbService.importCollection(
        collectionName,
        documents
      );

      this.logger.log(`Imported ${count} documents to ${collectionName}`);
      return count;
    } catch (error) {
      this.logger.error(
        `Import failed for ${collectionName}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to import data to ${collectionName}`
      );
    }
  }

  /**
   * Gets the migration status for all collections.
   * @returns The migration status.
   */
  async getMigrationStatus(): Promise<{
    firebaseCollections: string[];
    mongodbCollections: string[];
    migrated: string[];
    notMigrated: string[];
  }> {
    try {
      const firebaseCollections =
        await this.firebaseService.getAllCollections();
      const mongodbCollections = await this.mongodbService.getAllCollections();

      const migrated = firebaseCollections.filter((col) =>
        mongodbCollections.includes(col)
      );
      const notMigrated = firebaseCollections.filter(
        (col) => !mongodbCollections.includes(col)
      );

      this.logger.log(
        `Migration status - Migrated: ${migrated.length}, Not migrated: ${notMigrated.length}`
      );

      return {
        firebaseCollections,
        mongodbCollections,
        migrated,
        notMigrated,
      };
    } catch (error) {
      this.logger.error(`Failed to get migration status: ${error.message}`);
      throw new InternalServerErrorException('Failed to get migration status');
    }
  }

  /**
   * Syncs a single document from Firebase to MongoDB.
   * @param collectionName The name of the collection.
   * @param documentId The ID of the document.
   */
  async syncDocument(
    collectionName: string,
    documentId: string
  ): Promise<void> {
    try {
      // Fetch from Firebase
      const firebaseRef = this.firebaseService['database'].ref(
        `${collectionName}/${documentId}`
      );
      const snapshot = await firebaseRef.once('value');
      const data = snapshot.val();

      if (!data) {
        // Document doesn't exist in Firebase, delete from MongoDB
        await this.mongodbService.deleteData(collectionName, documentId);
        this.logger.log(
          `Deleted document ${documentId} from MongoDB ${collectionName}`
        );
      } else {
        // Update in MongoDB
        await this.mongodbService.modifyData(collectionName, data, documentId);
        this.logger.log(
          `Synced document ${documentId} to MongoDB ${collectionName}`
        );
      }
    } catch (error) {
      this.logger.error(
        `Sync failed for ${collectionName}/${documentId}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to sync document ${documentId}`
      );
    }
  }
}
