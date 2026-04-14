import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { BaseController } from '../shared/base.controller';
import { MongoDBService } from '../services/mongodb.service';
import { MigrationService } from '../services/migration.service';

/**
 * Controller for interacting with MongoDB.
 */
@Controller('mongodb')
export class MongoDBController extends BaseController {
  @Inject() private readonly mongodbService: MongoDBService;
  @Inject() private readonly migrationService: MigrationService;

  /**
   * Get all collections in the database.
   * @returns A list of all collections.
   */
  @Get('collections')
  async getCollections() {
    return this.mongodbService.getAllCollections();
  }

  /**
   * Get all data from a collection.
   * @param name The name of the collection.
   * @returns The data from the collection.
   */
  @Get('collections/:name')
  async getCollectionData(@Param('name') name: string) {
    return this.mongodbService.fetchData(name);
  }

  /**
   * Query a collection with filters and options.
   * @param name The name of the collection.
   * @param body The query body with filter and options.
   * @returns The result of the query.
   */
  @Post('collections/:name/query')
  async queryCollection(
    @Param('name') name: string,
    @Body() body: { filter?: any; options?: any }
  ) {
    return this.mongodbService.queryData(
      name,
      body.filter || {},
      body.options || {}
    );
  }

  /**
   * Get a document by its ID.
   * @param name The name of the collection.
   * @param id The ID of the document.
   * @returns The document with the specified ID.
   */
  @Get('collections/:name/documents/:id')
  async getDocument(@Param('name') name: string, @Param('id') id: string) {
    return this.mongodbService.fetchById(name, id);
  }

  /**
   * Create or update a document.
   * @param name The name of the collection.
   * @param body The document data and optional ID.
   * @returns The ID of the created or updated document.
   */
  @Post('collections/:name/documents')
  async createDocument(
    @Param('name') name: string,
    @Body() body: { data: any; id?: string }
  ) {
    const id = await this.mongodbService.modifyData(name, body.data, body.id);
    return { id, message: 'Document created/updated successfully' };
  }

  /**
   * Update a document.
   * @param name The name of the collection.
   * @param id The ID of the document.
   * @param data The new data for the document.
   * @returns A success message.
   */
  @Put('collections/:name/documents/:id')
  async updateDocument(
    @Param('name') name: string,
    @Param('id') id: string,
    @Body() data: any
  ) {
    await this.mongodbService.updateData(name, id, data);
    return { message: 'Document updated successfully' };
  }

  /**
   * Delete a document.
   * @param name The name of the collection.
   * @param id The ID of the document.
   * @returns A success message.
   */
  @Delete('collections/:name/documents/:id')
  async deleteDocument(@Param('name') name: string, @Param('id') id: string) {
    await this.mongodbService.deleteData(name, id);
    return { message: 'Document deleted successfully' };
  }

  /**
   * Delete multiple documents.
   * @param name The name of the collection.
   * @param body The IDs of the documents to delete.
   * @returns The number of deleted documents.
   */
  @Delete('collections/:name/documents')
  async deleteDocuments(
    @Param('name') name: string,
    @Body() body: { ids: string[] }
  ) {
    const count = await this.mongodbService.deleteMany(name, body.ids);
    return { message: `${count} documents deleted successfully` };
  }

  /**
   * Drop a collection.
   * @param name The name of the collection.
   * @returns A success message.
   */
  @Delete('collections/:name')
  async dropCollection(@Param('name') name: string) {
    const dropped = await this.mongodbService.dropCollection(name);
    return {
      message: dropped
        ? 'Collection dropped successfully'
        : 'Collection not found',
    };
  }

  /**
   * Count the number of documents in a collection.
   * @param name The name of the collection.
   * @param body The filter for counting documents.
   * @returns The number of documents.
   */
  @Post('collections/:name/count')
  async countDocuments(
    @Param('name') name: string,
    @Body() body: { filter?: any }
  ) {
    const count = await this.mongodbService.countDocuments(
      name,
      body.filter || {}
    );
    return { count };
  }

  /**
   * Get statistics for a collection.
   * @param name The name of the collection.
   * @returns The collection statistics.
   */
  @Get('collections/:name/stats')
  async getCollectionStats(@Param('name') name: string) {
    return this.mongodbService.getCollectionStats(name);
  }

  /**
   * Get statistics for the database.
   * @returns The database statistics.
   */
  @Get('stats')
  async getDatabaseStats() {
    return this.mongodbService.getDatabaseStats();
  }

  /**
   * Create an index on a collection.
   * @param name The name of the collection.
   * @param body The field and options for the index.
   * @returns The name of the created index.
   */
  @Post('collections/:name/indexes')
  async createIndex(
    @Param('name') name: string,
    @Body() body: { field: string | any; options?: any }
  ) {
    const indexName = await this.mongodbService.createIndex(
      name,
      body.field,
      body.options || {}
    );
    return { indexName, message: 'Index created successfully' };
  }

  /**
   * Aggregate data in a collection.
   * @param name The name of the collection.
   * @param body The aggregation pipeline.
   * @returns The result of the aggregation.
   */
  @Post('collections/:name/aggregate')
  async aggregate(
    @Param('name') name: string,
    @Body() body: { pipeline: any[] }
  ) {
    return this.mongodbService.aggregate(name, body.pipeline);
  }

  /**
   * Export a collection to JSON.
   * @param name The name of the collection.
   * @returns The exported data.
   */
  @Get('collections/:name/export')
  async exportCollection(@Param('name') name: string) {
    return this.mongodbService.exportCollection(name);
  }

  /**
   * Import data into a collection.
   * @param name The name of the collection.
   * @param body The data to import.
   * @returns The number of imported documents.
   */
  @Post('collections/:name/import')
  async importCollection(
    @Param('name') name: string,
    @Body() body: { data: any[] }
  ) {
    const count = await this.mongodbService.importCollection(name, body.data);
    return { count, message: `${count} documents imported successfully` };
  }

  // ============ Migration Endpoints ============

  /**
   * Get the status of the migration.
   * @returns The migration status.
   */
  @Get('migration/status')
  async getMigrationStatus() {
    return this.migrationService.getMigrationStatus();
  }

  /**
   * Migrate a single collection from Firebase to MongoDB.
   * @param name The name of the collection to migrate.
   * @param body The migration options.
   * @returns The progress of the migration.
   */
  @Post('migration/collections/:name')
  async migrateCollection(
    @Param('name') name: string,
    @Body()
    body: {
      preserveIds?: boolean;
      batchSize?: number;
    } = {}
  ) {
    const progress = await this.migrationService.migrateCollection(name, {
      preserveIds: body.preserveIds ?? true,
      batchSize: body.batchSize ?? 100,
    });
    return {
      progress,
      message: `Migration completed. Success: ${progress.migrated}, Failed: ${progress.failed}`,
    };
  }

  /**
   * Migrate all collections from Firebase to MongoDB.
   * @param body The migration options.
   * @returns The results of the migration for each collection.
   */
  @Post('migration/all')
  async migrateAllCollections(
    @Body()
    body: {
      preserveIds?: boolean;
      batchSize?: number;
      excludeCollections?: string[];
    } = {}
  ) {
    const results = await this.migrationService.migrateAllCollections({
      preserveIds: body.preserveIds ?? true,
      batchSize: body.batchSize ?? 100,
      excludeCollections: body.excludeCollections ?? [],
    });

    const totalMigrated = results.reduce((sum, r) => sum + r.migrated, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

    return {
      results,
      summary: {
        totalCollections: results.length,
        totalMigrated,
        totalFailed,
      },
      message: `Migration completed. Total migrated: ${totalMigrated}, Total failed: ${totalFailed}`,
    };
  }

  /**
   * Verify the migration of a collection.
   * @param name The name of the collection to verify.
   * @returns The verification results.
   */
  @Get('migration/verify/:name')
  async verifyMigration(@Param('name') name: string) {
    return this.migrationService.verifyMigration(name);
  }

  /**
   * Rollback the migration of a collection.
   * @param name The name of the collection to rollback.
   * @returns A success message.
   */
  @Delete('migration/collections/:name')
  async rollbackMigration(@Param('name') name: string) {
    const success = await this.migrationService.rollbackMigration(name);
    return {
      success,
      message: success
        ? 'Migration rolled back successfully'
        : 'Collection not found',
    };
  }

  /**
   * Export a Firebase collection to JSON.
   * @param name The name of the collection to export.
   * @returns The exported data.
   */
  @Get('migration/export/:name')
  async exportFirebaseData(@Param('name') name: string) {
    return this.migrationService.exportFirebaseToJSON(name);
  }

  /**
   * Import JSON data into a MongoDB collection.
   * @param name The name of the collection.
   * @param data The data to import.
   * @returns The number of imported documents.
   */
  @Post('migration/import/:name')
  async importJSONData(@Param('name') name: string, @Body() data: any) {
    const count = await this.migrationService.importJSONToMongoDB(name, data);
    return { count, message: `${count} documents imported successfully` };
  }

  /**
   * Sync a single document from Firebase to MongoDB.
   * @param collection The name of the collection.
   * @param id The ID of the document.
   * @returns A success message.
   */
  @Post('migration/sync/:collection/:id')
  async syncDocument(
    @Param('collection') collection: string,
    @Param('id') id: string
  ) {
    await this.migrationService.syncDocument(collection, id);
    return { message: 'Document synced successfully' };
  }
}
