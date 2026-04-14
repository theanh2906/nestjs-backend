# AI Coding Agent Instructions - NestJS System Monitor

## Architecture Overview

This is a **NestJS-based system monitoring service** with multi-protocol messaging capabilities. The architecture centers on:

- **Real-time monitoring** via WebSocket (Socket.io) for system metrics and live updates
- **Message queue integrations**: Kafka, RabbitMQ (AMQP + STOMP), and NATS
- **Multi-protocol APIs**: REST, gRPC, WebSocket, and SSE (Server-Sent Events)
- **Cloud integrations**: Firebase Admin SDK, Azure (MSAL), Google APIs
- **File management**: ZIP archiving, Firebase Storage, and ultrasound image handling

Key architectural decision: **Conditional feature enablement** - Most integrations (Kafka, RabbitMQ, MongoDB) are feature-flagged via environment variables (`KAFKA_ENABLED`, `RABBITMQ_ENABLED`, `MONGODB_ENABLED`) to support flexible deployment scenarios.

## Module Structure

```
src/
├── app.module.ts          # Central DI container with 10+ provider factories
├── app.gateway.ts         # WebSocket hub (Socket.io) for real-time features
├── controllers/           # REST/SSE endpoints (exported via index.ts barrel)
├── services/              # Business logic (exported via index.ts barrel)
├── shared/                # Base classes, constants, logger utilities
├── guards/                # Rate limiting (Throttler-based)
├── interceptors/          # Data modification broadcasting via WebSocket
└── environments/          # local.env, prod.env - NODE_ENV-based selection
```

**Barrel exports pattern**: Controllers and services use `index.ts` for centralized exports (`export * from './kafka.service'`) and are imported as `import * as services from './services'` in `app.module.ts`.

## Critical Developer Workflows

### Development Commands

```powershell
npm run dev           # Local development with watch mode (NODE_ENV=local)
npm run build:prod    # Production build + copy-files.js for non-TS assets
npm start             # Production server (NODE_ENV=prod)
npm run test:crawler  # Web scraping test (Cheerio-based)
```

### Environment Configuration

- **Environment files**: `src/environments/{NODE_ENV}.env` (local.env, prod.env)
- **Secret management**: Base64-encoded JSON files in `secrets/*.b64` (see `app.module.ts` lines 150-199)
  - `getDecodedContent('serviceAccountKey.b64')` decodes Firebase credentials
  - `getAppSecrets()` loads all secrets into APP_SECRETS provider
- **Feature flags**: Check `KAFKA_ENABLED`, `RABBITMQ_ENABLED` before initializing services

### Key Initialization Pattern (app.module.ts)

The module uses async factory providers for delayed initialization:

```typescript
{
  provide: 'FIREBASE_ADMIN',
  useFactory: async () => admin.initializeApp({
    credential: admin.credential.cert(await getDecodedContent('serviceAccountKey.b64'))
  })
}
```

## Project-Specific Patterns

### 1. Base Class Hierarchy

- **BaseController** and **BaseService** extend `AppLogger` (from `shared/logger.ts`)
- Provides consistent logging interface across all components
- Usage: `this.logger.log()` available in all services/controllers

### 2. WebSocket Data Broadcasting

The `DataModificationInterceptor` (registered globally in `main.ts`) automatically broadcasts all API response modifications via WebSocket `data-update` event to connected clients.

### 3. Rate Limiting Strategy

- **Global guard**: `RateLimitGuards` applied via `APP_GUARD` in app.module
- **Throttler config**: 10 requests per 60 seconds (app.module.ts lines 44-48)
- Controllers can override with `@UseGuards()` decorator

### 4. Conditional Service Initialization

Services check feature flags in constructors/lifecycle hooks:

```typescript
async onModuleInit() {
  if (!this.KAFKA_CONFIG.KAFKA_ENABLED) return;
  // Initialize Kafka...
}
```

### 5. SSE Event Broadcasting

- **SseService** (`services/sse.service.ts`) - Subject-based event emitter
- **Pattern**: Controllers trigger `sseService.emit(SseEvent.MonitorReport, data)`
- Consumers subscribe to `@Sse()` endpoints that return `Observable<MessageEvent>`
- See `kafka-monitor.controller.ts` for reference implementation

## Integration Points

### Message Queue Consumers

- **Kafka**: `KafkaService.consumeMessages()` with partition assignment and offset management
- **RabbitMQ**: Dual-mode - AMQP queues + STOMP WebSocket subscriptions
- **Pattern**: Services emit to `SseService` for real-time client updates

### Cloud Service Authentication

- **Firebase**: Service account loaded from `secrets/serviceAccountKey.b64`
- **Azure**: MSAL with client credentials flow (see `azure.service.ts`)
- **Google APIs**: JWT-based OAuth2 with `googleapis` library

### File Storage Locations

- `uploads/` - Temporary file uploads (multer memory storage by default)
- `data/storage/rooms/{userId}/` - User-specific file storage
- `data/storage/ultrasound_images/` - Medical imaging files
- Firebase Storage bucket configured via `FIREBASE_STORAGE_BUCKET` env var

## Testing & Debugging

- **E2E tests**: `npm run test:e2e` with Jest config at `test/jest-e2e.json`
- **Debug mode**: `npm run debug` (enables Node.js inspector on port 9229)
- **Kafka reset**: `kafka-reset.bat` - Clears local Kafka state for testing
- **Web crawler testing**: `npm run test:crawler` with URL pagination support

## Common Pitfalls

1. **Missing environment file**: Service fails silently if `NODE_ENV` doesn't match a file in `src/environments/`
2. **Secret file format**: Secrets MUST be base64-encoded JSON, not plain text
3. **WebSocket CORS**: App uses `origin: '*'` - restrict in production (main.ts, app.gateway.ts)
4. **MongoDB connection**: Optional but auto-connects if `MONGODB_URI` is set - disable with `MONGODB_ENABLED=false`
5. **gRPC proto loading**: Commented out in `main.ts` - uncomment and configure `proto/*.proto` paths if needed

## Documentation References

- Architecture deep-dive: `CLAUDE.md` (workflow orchestration rules)
- Feature-specific guides: `KAFKA_MONITORING_README.md`, `RabbitMQ_NestJS.md`, `JENKINS_SSE_MIGRATION.md`
- Deployment: `docker-compose.yml` (host network mode, volume bindings for Obsidian/Firebase data)
- Scheduled tasks: `SCHEDULER_README.md` (cron job management with `@nestjs/schedule`)

## Code Quality Standards

- **Pre-commit hooks**: Husky + lint-staged runs `normalize-line-endings.js` and Prettier
- **Line endings**: Enforce LF via `normalize-line-endings.js` before commits
- **Linting**: `npm run lint` (ESLint with TypeScript parser)
- **Formatting**: `npm run prettier:fix` (Prettier with `.prettierrc`)
