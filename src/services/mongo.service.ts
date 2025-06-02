import { Injectable } from '@nestjs/common';
import {
  Collection,
  Db,
  Document,
  Filter,
  MongoClient,
  OptionalUnlessRequiredId,
  UpdateFilter,
} from 'mongodb';

@Injectable()
export class MongoService {
  private client: MongoClient;
  private db: Db;

  async connect(uri: string, dbName: string) {
    if (!this.client) {
      this.client = new MongoClient(uri);
      await this.client.connect();
      this.db = this.client.db(dbName);
    }
    return this.db;
  }

  getCollection<T extends Document>(name: string): Collection<T> {
    if (!this.db) throw new Error('MongoDB not connected');
    return this.db.collection<T>(name);
  }

  async create<T extends Document>(
    collection: string,
    doc: OptionalUnlessRequiredId<T>
  ) {
    return this.getCollection<T>(collection).insertOne(doc);
  }

  async find<T extends Document>(collection: string, filter: Filter<T> = {}) {
    return this.getCollection<T>(collection).find(filter).toArray();
  }

  async findOne<T extends Document>(
    collection: string,
    filter: Filter<T> = {}
  ) {
    return this.getCollection<T>(collection).findOne(filter);
  }

  async update<T extends Document>(
    collection: string,
    filter: Filter<T>,
    update: UpdateFilter<T> | Partial<T>
  ) {
    return this.getCollection<T>(collection).updateMany(filter, update);
  }

  async delete<T extends Document>(collection: string, filter: Filter<T>) {
    return this.getCollection<T>(collection).deleteMany(filter);
  }

  async close() {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
    }
  }
}
