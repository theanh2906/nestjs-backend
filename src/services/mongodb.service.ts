import {
  Inject,
  Injectable,
  InternalServerErrorException,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { BaseService } from '../shared/base.service';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { v4 as uuid } from 'uuid';

export interface MongoDBDocument {
  _id?: string;
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: any;
}

/**
 * Service for interacting with MongoDB.
 */
@Injectable()
export class MongoDBService
  extends BaseService
  implements OnModuleInit, OnModuleDestroy
{
  @InjectConnection() private readonly connection: Connection;
  private collections: Map<string, Model<any>> = new Map();

  /**
   * Initializes the MongoDB connection and sets up listeners.
   */
  async onModuleInit() {
    this.logger.log('MongoDB Service initialized');
    this.connection.on('connected', () => {
      this.logger.log('MongoDB connected successfully');
    });

    this.connection.on('error', (error) => {
      this.logger.error(`MongoDB connection error: ${error.message}`);
    });

    this.connection.on('disconnected', () => {
      this.logger.warn('MongoDB disconnected');
    });
  }

  /**
   * Cleans up the MongoDB connection on module destruction.
   */
  async onModuleDestroy() {
    await this.connection.close();
    this.logger.log('MongoDB connection closed');
  }

  /**
   * Gets or creates a collection model.
   * @param collectionName The name of the collection.
   * @returns The Mongoose model for the collection.
   */
  private getCollection(collectionName: string): Model<any> {
    if (!this.collections.has(collectionName)) {
      const schema = new this.connection.base.Schema(
        {
          _id: { type: String },
          data: { type: Object, default: {} },
        },
        { strict: false, timestamps: true, _id: false }
      );
      const model = this.connection.model(collectionName, schema);
      this.collections.set(collectionName, model);
    }
    return this.collections.get(collectionName);
  }

  /**
   * Fetches all data from a collection.
   * @param collectionName The name of the collection.
   * @returns The data from the collection.
   */
  async fetchData(collectionName: string): Promise<any> {
    try {
      const collection = this.getCollection(collectionName);
      const documents = await collection.find({}).lean().exec();

      // Format data to match Firebase structure (key-value pairs)
      const result = {};
      documents.forEach((doc: any) => {
        const { _id, __v, createdAt, updatedAt, ...data } = doc;
        result[_id.toString()] = data;
      });

      return result;
    } catch (error) {
      this.logger.error(
        `Error fetching data from ${collectionName}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to fetch data from ${collectionName}`
      );
    }
  }

  /**
   * Fetches a single document by its ID.
   * @param collectionName The name of the collection.
   * @param id The ID of the document.
   * @returns The document data.
   */
  async fetchById(collectionName: string, id: string): Promise<any> {
    try {
      const collection = this.getCollection(collectionName);
      const document = await collection.findOne({ _id: id }).lean().exec();

      if (!document) {
        return null;
      }

      const { _id, __v, createdAt, updatedAt, ...data } = document as any;
      return data;
    } catch (error) {
      this.logger.error(
        `Error fetching document ${id} from ${collectionName}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to fetch document from ${collectionName}`
      );
    }
  }

  /**
   * Queries data from a collection with filters and options.
   * @param collectionName The name of the collection.
   * @param filter The filter to apply.
   * @param options The options for the query.
   * @returns The result of the query.
   */
  async queryData(
    collectionName: string,
    filter: any = {},
    options: {
      limit?: number;
      skip?: number;
      sort?: any;
      select?: string;
    } = {}
  ): Promise<any[]> {
    try {
      const collection = this.getCollection(collectionName);
      let query = collection.find(filter);

      if (options.limit) query = query.limit(options.limit);
      if (options.skip) query = query.skip(options.skip);
      if (options.sort) query = query.sort(options.sort);
      if (options.select) query = query.select(options.select);

      const documents = await query.lean().exec();
      return documents.map((doc: any) => {
        const { __v, ...data } = doc;
        return data;
      });
    } catch (error) {
      this.logger.error(
        `Error querying data from ${collectionName}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to query data from ${collectionName}`
      );
    }
  }

  /**
   * Adds or modifies data in a collection.
   * @param collectionName The name of the collection.
   * @param data The data to add or modify.
   * @param id The ID of the document.
   * @returns The ID of the modified document.
   */
  async modifyData(
    collectionName: string,
    data: any,
    id?: string
  ): Promise<string> {
    try {
      const collection = this.getCollection(collectionName);
      const documentId = id || uuid();

      await collection.updateOne(
        { _id: documentId },
        { $set: { _id: documentId, ...data } },
        { upsert: true }
      );

      this.logger.log(
        `Data modified in ${collectionName} with ID: ${documentId}`
      );
      return documentId;
    } catch (error) {
      this.logger.error(
        `Error modifying data in ${collectionName}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to modify data in ${collectionName}`
      );
    }
  }

  /**
   * Sets the data for a document, replacing the entire document.
   * @param collectionName The name of the collection.
   * @param id The ID of the document.
   * @param data The new data for the document.
   */
  async setData(collectionName: string, id: string, data: any): Promise<void> {
    try {
      const collection = this.getCollection(collectionName);
      await collection.updateOne(
        { _id: id },
        { _id: id, ...data },
        { upsert: true }
      );

      this.logger.log(`Data set in ${collectionName} with ID: ${id}`);
    } catch (error) {
      this.logger.error(
        `Error setting data in ${collectionName}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to set data in ${collectionName}`
      );
    }
  }

  /**
   * Updates data in a document.
   * @param collectionName The name of the collection.
   * @param id The ID of the document.
   * @param data The data to update.
   */
  async updateData(
    collectionName: string,
    id: string,
    data: any
  ): Promise<void> {
    try {
      const collection = this.getCollection(collectionName);
      const result = await collection.updateOne({ _id: id }, { $set: data });

      if (result.matchedCount === 0) {
        throw new Error(`Document with ID ${id} not found`);
      }

      this.logger.log(`Data updated in ${collectionName} with ID: ${id}`);
    } catch (error) {
      this.logger.error(
        `Error updating data in ${collectionName}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to update data in ${collectionName}`
      );
    }
  }

  /**
   * Deletes data from a collection.
   * @param collectionName The name of the collection.
   * @param id The ID of the document to delete.
   */
  async deleteData(collectionName: string, id: string): Promise<void> {
    try {
      const collection = this.getCollection(collectionName);
      const result = await collection.deleteOne({ _id: id });

      if (result.deletedCount === 0) {
        throw new Error(`Document with ID ${id} not found`);
      }

      this.logger.log(`Data deleted from ${collectionName} with ID: ${id}`);
    } catch (error) {
      this.logger.error(
        `Error deleting data from ${collectionName}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to delete data from ${collectionName}`
      );
    }
  }

  /**
   * Deletes multiple documents by their IDs.
   * @param collectionName The name of the collection.
   * @param ids The IDs of the documents to delete.
   * @returns The number of deleted documents.
   */
  async deleteMany(collectionName: string, ids: string[]): Promise<number> {
    try {
      const collection = this.getCollection(collectionName);
      const result = await collection.deleteMany({ _id: { $in: ids } });

      this.logger.log(
        `Deleted ${result.deletedCount} documents from ${collectionName}`
      );
      return result.deletedCount;
    } catch (error) {
      this.logger.error(
        `Error deleting multiple documents from ${collectionName}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to delete documents from ${collectionName}`
      );
    }
  }

  /**
   * Gets all collection names in the database.
   * @returns A list of collection names.
   */
  async getAllCollections(): Promise<string[]> {
    try {
      const collections = await this.connection.db.listCollections().toArray();
      return collections.map((c) => c.name);
    } catch (error) {
      this.logger.error(`Error getting all collections: ${error.message}`);
      throw new InternalServerErrorException('Failed to get all collections');
    }
  }

  /**
   * Gets all data from a collection.
   * @param collectionName The name of the collection.
   * @returns The data from the collection.
   */
  async getCollectionData(collectionName: string): Promise<any> {
    return this.fetchData(collectionName);
  }

  /**
   * Counts the number of documents in a collection.
   * @param collectionName The name of the collection.
   * @param filter The filter to apply.
   * @returns The number of documents.
   */
  async countDocuments(
    collectionName: string,
    filter: any = {}
  ): Promise<number> {
    try {
      const collection = this.getCollection(collectionName);
      return await collection.countDocuments(filter);
    } catch (error) {
      this.logger.error(
        `Error counting documents in ${collectionName}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to count documents in ${collectionName}`
      );
    }
  }

  /**
   * Checks if a document exists.
   * @param collectionName The name of the collection.
   * @param id The ID of the document.
   * @returns True if the document exists, false otherwise.
   */
  async exists(collectionName: string, id: string): Promise<boolean> {
    try {
      const collection = this.getCollection(collectionName);
      const count = await collection.countDocuments({ _id: id });
      return count > 0;
    } catch (error) {
      this.logger.error(
        `Error checking document existence in ${collectionName}: ${error.message}`
      );
      return false;
    }
  }

  /**
   * Aggregates data in a collection.
   * @param collectionName The name of the collection.
   * @param pipeline The aggregation pipeline.
   * @returns The result of the aggregation.
   */
  async aggregate(collectionName: string, pipeline: any[]): Promise<any[]> {
    try {
      const collection = this.getCollection(collectionName);
      return await collection.aggregate(pipeline).exec();
    } catch (error) {
      this.logger.error(
        `Error aggregating data in ${collectionName}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to aggregate data in ${collectionName}`
      );
    }
  }

  /**
   * Performs bulk write operations on a collection.
   * @param collectionName The name of the collection.
   * @param operations The bulk write operations to perform.
   * @returns The result of the bulk write operation.
   */
  async bulkWrite(collectionName: string, operations: any[]): Promise<any> {
    try {
      const collection = this.getCollection(collectionName);
      return await collection.bulkWrite(operations);
    } catch (error) {
      this.logger.error(
        `Error performing bulk write in ${collectionName}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to perform bulk write in ${collectionName}`
      );
    }
  }

  /**
   * Creates an index on a collection.
   * @param collectionName The name of the collection.
   * @param field The field to create the index on.
   * @param options The options for the index.
   * @returns The name of the created index.
   */
  async createIndex(
    collectionName: string,
    field: string | any,
    options: any = {}
  ): Promise<string> {
    try {
      const collection = this.getCollection(collectionName);
      const indexSpec = typeof field === 'string' ? { [field]: 1 } : field;
      await collection.collection.createIndex(indexSpec, options);
      return `index_created_on_${JSON.stringify(indexSpec)}`;
    } catch (error) {
      this.logger.error(
        `Error creating index in ${collectionName}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to create index in ${collectionName}`
      );
    }
  }

  /**
   * Drops a collection.
   * @param collectionName The name of the collection to drop.
   * @returns True if the collection was dropped, false otherwise.
   */
  async dropCollection(collectionName: string): Promise<boolean> {
    try {
      await this.connection.db.dropCollection(collectionName);
      this.collections.delete(collectionName);
      this.logger.log(`Collection ${collectionName} dropped successfully`);
      return true;
    } catch (error) {
      if (error.message.includes('ns not found')) {
        return false;
      }
      this.logger.error(
        `Error dropping collection ${collectionName}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to drop collection ${collectionName}`
      );
    }
  }

  /**
   * Watches for changes in a collection.
   * @param collectionName The name of the collection to watch.
   * @param callback The callback to execute when a change occurs.
   * @param pipeline The aggregation pipeline to apply to the change stream.
   * @returns The change stream.
   */
  watchCollection(
    collectionName: string,
    callback: (change: any) => void,
    pipeline: any[] = []
  ) {
    try {
      const collection = this.getCollection(collectionName);
      const changeStream = collection.watch(pipeline);

      changeStream.on('change', (change) => {
        this.logger.log(
          `Change detected in ${collectionName}: ${change.operationType}`
        );
        callback(change);
      });

      changeStream.on('error', (error) => {
        this.logger.error(
          `Error in change stream for ${collectionName}: ${error.message}`
        );
      });

      return changeStream;
    } catch (error) {
      this.logger.error(
        `Error watching collection ${collectionName}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to watch collection ${collectionName}`
      );
    }
  }

  /**
   * Gets statistics for the database.
   * @returns The database statistics.
   */
  async getDatabaseStats(): Promise<any> {
    try {
      return await this.connection.db.stats();
    } catch (error) {
      this.logger.error(`Error getting database stats: ${error.message}`);
      throw new InternalServerErrorException('Failed to get database stats');
    }
  }

  /**
   * Gets statistics for a collection.
   * @param collectionName The name of the collection.
   * @returns The collection statistics.
   */
  async getCollectionStats(collectionName: string): Promise<any> {
    try {
      const collection = this.getCollection(collectionName);
      const stats = await this.connection.db.command({
        collStats: collectionName,
      });
      return stats;
    } catch (error) {
      this.logger.error(
        `Error getting collection stats for ${collectionName}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to get collection stats for ${collectionName}`
      );
    }
  }

  /**
   * Runs a callback in a transaction.
   * @param callback The callback to run in the transaction.
   * @returns The result of the callback.
   */
  async runInTransaction(
    callback: (session: any) => Promise<any>
  ): Promise<any> {
    const session = await this.connection.startSession();
    session.startTransaction();

    try {
      const result = await callback(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      this.logger.error(`Transaction failed: ${error.message}`);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Exports a collection to a JSON array.
   * @param collectionName The name of the collection to export.
   * @returns The exported data.
   */
  async exportCollection(collectionName: string): Promise<any[]> {
    try {
      const collection = this.getCollection(collectionName);
      return await collection.find({}).lean().exec();
    } catch (error) {
      this.logger.error(
        `Error exporting collection ${collectionName}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to export collection ${collectionName}`
      );
    }
  }

  /**
   * Imports data into a collection.
   * @param collectionName The name of the collection.
   * @param data The data to import.
   * @returns The number of imported documents.
   */
  async importCollection(collectionName: string, data: any[]): Promise<number> {
    try {
      const collection = this.getCollection(collectionName);
      const result = await collection.insertMany(data, { ordered: false });
      this.logger.log(
        `Imported ${result.length} documents to ${collectionName}`
      );
      return result.length;
    } catch (error) {
      this.logger.error(
        `Error importing to collection ${collectionName}: ${error.message}`
      );
      throw new InternalServerErrorException(
        `Failed to import to collection ${collectionName}`
      );
    }
  }
}
