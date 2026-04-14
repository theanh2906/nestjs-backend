# MongoDB Migration Guide - Firebase to MongoDB

## Overview

This guide will help you migrate from Firebase Realtime Database to MongoDB server.

## Architecture

### Services Created

1. **MongoDBService** (`src/services/mongodb.service.ts`)

   - Full CRUD operations
   - Collection management
   - Advanced querying (filters, pagination, sorting)
   - Aggregation pipelines
   - Transaction support
   - Change streams (real-time updates)
   - Import/Export functionality

2. **MigrationService** (`src/services/migration.service.ts`)

   - Single collection migration
   - Bulk migration (all collections)
   - Migration verification
   - Rollback functionality
   - Data sync from Firebase to MongoDB

3. **MongoDBController** (`src/controllers/mongodb.controller.ts`)
   - REST API endpoints for MongoDB operations
   - Migration endpoints
   - Collection management endpoints

## Setup Instructions

### 1. Install MongoDB Server

```bash
# Windows (using Chocolatey)
choco install mongodb

# Or download from: https://www.mongodb.com/try/download/community

# Start MongoDB service
net start MongoDB
```

### 2. Configure Environment Variables

Edit your environment files (`src/environments/local.env` or `prod.env`):

```env
# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/nestjs-backend
MONGODB_ENABLED=true
```

For cloud MongoDB (MongoDB Atlas):

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

### 3. Start the Application

```bash
npm run dev
```

## Migration Process

### Option 1: Using API Endpoints

#### Step 1: Check Migration Status

```bash
GET http://localhost:3000/mongodb/migration/status
```

#### Step 2: Migrate Single Collection

```bash
POST http://localhost:3000/mongodb/migration/collections/{collectionName}
Content-Type: application/json

{
  "preserveIds": true,
  "batchSize": 100
}
```

#### Step 3: Migrate All Collections

```bash
POST http://localhost:3000/mongodb/migration/all
Content-Type: application/json

{
  "preserveIds": true,
  "batchSize": 100,
  "excludeCollections": []
}
```

#### Step 4: Verify Migration

```bash
GET http://localhost:3000/mongodb/migration/verify/{collectionName}
```

### Option 2: Using Service Directly (Programmatically)

```typescript
import { MigrationService } from './services/migration.service';

// Inject the service
constructor(private migrationService: MigrationService) {}

// Migrate single collection
async migrate() {
  const progress = await this.migrationService.migrateCollection('users', {
    preserveIds: true,
    batchSize: 100,
    onProgress: (progress) => {
      console.log(`Progress: ${progress.migrated}/${progress.total}`);
    }
  });

  console.log('Migration completed:', progress);
}

// Migrate all collections
async migrateAll() {
  const results = await this.migrationService.migrateAllCollections({
    preserveIds: true,
    batchSize: 100,
    excludeCollections: ['temp_data'],
    onProgress: (collection, progress) => {
      console.log(`${collection}: ${progress.migrated}/${progress.total}`);
    }
  });

  console.log('All migrations completed:', results);
}
```

## API Endpoints Reference

### MongoDB Operations

#### Collections

- `GET /mongodb/collections` - Get all collections
- `GET /mongodb/collections/:name` - Get collection data
- `POST /mongodb/collections/:name/query` - Query with filters
- `DELETE /mongodb/collections/:name` - Drop collection

#### Documents

- `GET /mongodb/collections/:name/documents/:id` - Get document by ID
- `POST /mongodb/collections/:name/documents` - Create/Update document
- `PUT /mongodb/collections/:name/documents/:id` - Update document
- `DELETE /mongodb/collections/:name/documents/:id` - Delete document
- `DELETE /mongodb/collections/:name/documents` - Delete multiple documents

#### Advanced Operations

- `POST /mongodb/collections/:name/count` - Count documents
- `GET /mongodb/collections/:name/stats` - Get collection statistics
- `GET /mongodb/stats` - Get database statistics
- `POST /mongodb/collections/:name/indexes` - Create index
- `POST /mongodb/collections/:name/aggregate` - Run aggregation
- `GET /mongodb/collections/:name/export` - Export collection
- `POST /mongodb/collections/:name/import` - Import collection

### Migration Operations

- `GET /mongodb/migration/status` - Get migration status
- `POST /mongodb/migration/collections/:name` - Migrate single collection
- `POST /mongodb/migration/all` - Migrate all collections
- `GET /mongodb/migration/verify/:name` - Verify migration
- `DELETE /mongodb/migration/collections/:name` - Rollback migration
- `GET /mongodb/migration/export/:name` - Export Firebase data
- `POST /mongodb/migration/import/:name` - Import to MongoDB
- `POST /mongodb/migration/sync/:collection/:id` - Sync single document

## Usage Examples

### 1. Query with Filters

```bash
POST http://localhost:3000/mongodb/collections/users/query
Content-Type: application/json

{
  "filter": {
    "age": { "$gte": 18 },
    "status": "active"
  },
  "options": {
    "limit": 10,
    "skip": 0,
    "sort": { "createdAt": -1 },
    "select": "name email age"
  }
}
```

### 2. Aggregation Pipeline

```bash
POST http://localhost:3000/mongodb/collections/orders/aggregate
Content-Type: application/json

{
  "pipeline": [
    { "$match": { "status": "completed" } },
    { "$group": {
      "_id": "$userId",
      "totalOrders": { "$sum": 1 },
      "totalAmount": { "$sum": "$amount" }
    }},
    { "$sort": { "totalAmount": -1 } },
    { "$limit": 10 }
  ]
}
```

### 3. Create Index

```bash
POST http://localhost:3000/mongodb/collections/users/indexes
Content-Type: application/json

{
  "field": { "email": 1 },
  "options": { "unique": true }
}
```

## Key Features Comparison

| Feature           | Firebase Realtime DB | MongoDB Service                   |
| ----------------- | -------------------- | --------------------------------- |
| CRUD Operations   | ✅                   | ✅                                |
| Real-time Updates | ✅                   | ✅ (Change Streams)               |
| Querying          | Limited              | Advanced (MongoDB Query Language) |
| Indexing          | Auto                 | Manual + Auto                     |
| Transactions      | Limited              | Full ACID                         |
| Aggregation       | No                   | Yes                               |
| Schema            | Schemaless           | Flexible Schema                   |
| Offline Support   | Yes                  | Via Client                        |

## MongoDB Service Methods

### Basic Operations

- `fetchData(collection)` - Get all documents
- `fetchById(collection, id)` - Get single document
- `modifyData(collection, data, id?)` - Create/Update document
- `updateData(collection, id, data)` - Update document
- `deleteData(collection, id)` - Delete document
- `deleteMany(collection, ids)` - Delete multiple documents

### Advanced Operations

- `queryData(collection, filter, options)` - Query with filters
- `aggregate(collection, pipeline)` - Run aggregation
- `bulkWrite(collection, operations)` - Bulk operations
- `countDocuments(collection, filter)` - Count documents
- `exists(collection, id)` - Check if document exists

### Collection Management

- `getAllCollections()` - Get all collections
- `getCollectionData(collection)` - Get collection data
- `dropCollection(collection)` - Drop collection
- `createIndex(collection, field, options)` - Create index

### Utilities

- `getDatabaseStats()` - Get database statistics
- `getCollectionStats(collection)` - Get collection statistics
- `exportCollection(collection)` - Export to JSON
- `importCollection(collection, data)` - Import from JSON
- `watchCollection(collection, callback)` - Watch for changes
- `runInTransaction(callback)` - Run in transaction

## Best Practices

1. **Indexing**: Create indexes on frequently queried fields

   ```typescript
   await mongodbService.createIndex('users', { email: 1 }, { unique: true });
   ```

2. **Batch Operations**: Use bulk operations for multiple updates

   ```typescript
   await mongodbService.bulkWrite('users', [
     {
       updateOne: {
         filter: { _id: 'id1' },
         update: { $set: { status: 'active' } },
       },
     },
     { deleteOne: { filter: { _id: 'id2' } } },
   ]);
   ```

3. **Pagination**: Always use limit and skip for large datasets

   ```typescript
   await mongodbService.queryData('users', {}, { limit: 20, skip: 0 });
   ```

4. **Aggregation**: Use aggregation for complex queries
   ```typescript
   await mongodbService.aggregate('orders', [
     { $match: { status: 'completed' } },
     { $group: { _id: '$userId', total: { $sum: '$amount' } } },
   ]);
   ```

## Rollback Strategy

If you need to rollback a migration:

```bash
# Rollback single collection
DELETE http://localhost:3000/mongodb/migration/collections/{collectionName}

# Or programmatically
await migrationService.rollbackMigration('users');
```

## Monitoring

Monitor your migration progress:

```typescript
const progress = await migrationService.migrateCollection('users', {
  onProgress: (progress) => {
    console.log(`
      Collection: ${progress.collection}
      Total: ${progress.total}
      Migrated: ${progress.migrated}
      Failed: ${progress.failed}
      Progress: ${((progress.migrated / progress.total) * 100).toFixed(2)}%
    `);
  },
});
```

## Troubleshooting

### Connection Issues

- Ensure MongoDB server is running
- Check MONGODB_URI in environment file
- Verify network connectivity

### Migration Issues

- Check Firebase credentials
- Verify data format
- Review error logs in migration progress

### Performance Issues

- Reduce batchSize for large documents
- Create appropriate indexes
- Use pagination for large queries

## Next Steps

1. ✅ Install MongoDB server
2. ✅ Configure environment variables
3. ✅ Start application and test connection
4. ✅ Run migration for test collection
5. ✅ Verify migrated data
6. ✅ Migrate all collections
7. ✅ Update application code to use MongoDB
8. ✅ Test thoroughly
9. ✅ Deploy to production

## Support

For issues or questions:

- Check application logs
- Review MongoDB documentation
- Contact development team
