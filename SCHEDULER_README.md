# Scheduler Management System

Hệ thống quản lý và điều khiển scheduler tasks trong NestJS backend.

## Tổng quan

Hệ thống scheduler cho phép bật/tắt các scheduled tasks (cronjobs) thông qua:

- Environment variables (cấu hình khởi động)
- REST API endpoints (điều khiển runtime)

## Cấu hình Environment Variables

### Local Environment (`src/environments/local.env`)

```env
# Scheduler Configuration
SCHEDULER_ENABLED=true                      # Bật/tắt toàn bộ scheduler
BACKUP_DATABASE_SCHEDULER_ENABLED=true      # Bật/tắt backup Firebase Database
BACKUP_STORAGE_SCHEDULER_ENABLED=true       # Bật/tắt backup Firebase Storage
```

### Production Environment (`src/environments/prod.env`)

```env
# Scheduler Configuration
SCHEDULER_ENABLED=true                      # Bật/tắt toàn bộ scheduler
BACKUP_DATABASE_SCHEDULER_ENABLED=true      # Bật/tắt backup Firebase Database
BACKUP_STORAGE_SCHEDULER_ENABLED=true       # Bật/tắt backup Firebase Storage
```

## Các Scheduler Tasks Hiện Tại

1. **backupFirebaseDatabase** - Backup Firebase Realtime Database

   - Schedule: `0 */1 * * *` (mỗi giờ)
   - Env variable: `BACKUP_DATABASE_SCHEDULER_ENABLED`

2. **backupFirebaseStorage** - Backup Firebase Storage
   - Schedule: `0 */1 * * *` (mỗi giờ)
   - Env variable: `BACKUP_STORAGE_SCHEDULER_ENABLED`

## REST API Endpoints

### 1. Xem trạng thái tất cả schedulers

```bash
GET /scheduler/status
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "name": "backupFirebaseDatabase",
      "enabled": true,
      "running": true,
      "nextRun": "2026-01-27T15:00:00.000Z",
      "lastRun": "2026-01-27T14:00:00.000Z"
    },
    {
      "name": "backupFirebaseStorage",
      "enabled": true,
      "running": true,
      "nextRun": "2026-01-27T15:00:00.000Z",
      "lastRun": "2026-01-27T14:00:00.000Z"
    }
  ]
}
```

### 2. Xem trạng thái một scheduler cụ thể

```bash
GET /scheduler/status/:name
```

**Example:**

```bash
GET /scheduler/status/backupFirebaseDatabase
```

**Response:**

```json
{
  "success": true,
  "data": {
    "name": "backupFirebaseDatabase",
    "enabled": true,
    "running": true,
    "nextRun": "2026-01-27T15:00:00.000Z",
    "lastRun": "2026-01-27T14:00:00.000Z"
  }
}
```

### 3. Bật một scheduler

```bash
POST /scheduler/enable/:name
```

**Example:**

```bash
POST /scheduler/enable/backupFirebaseDatabase
```

**Response:**

```json
{
  "success": true,
  "message": "Scheduler 'backupFirebaseDatabase' enabled successfully"
}
```

### 4. Tắt một scheduler

```bash
POST /scheduler/disable/:name
```

**Example:**

```bash
POST /scheduler/disable/backupFirebaseDatabase
```

**Response:**

```json
{
  "success": true,
  "message": "Scheduler 'backupFirebaseDatabase' disabled successfully"
}
```

### 5. Toggle (bật/tắt) một scheduler

```bash
POST /scheduler/toggle/:name
```

**Example:**

```bash
POST /scheduler/toggle/backupFirebaseDatabase
```

**Response:**

```json
{
  "success": true,
  "message": "Scheduler 'backupFirebaseDatabase' disabled successfully",
  "previousState": "enabled",
  "currentState": "disabled"
}
```

### 6. Bật tất cả schedulers

```bash
POST /scheduler/enable-all
```

**Response:**

```json
{
  "success": true,
  "message": "All schedulers enabled successfully",
  "details": [
    {
      "name": "backupFirebaseDatabase",
      "success": true
    },
    {
      "name": "backupFirebaseStorage",
      "success": true
    }
  ]
}
```

### 7. Tắt tất cả schedulers

```bash
POST /scheduler/disable-all
```

**Response:**

```json
{
  "success": true,
  "message": "All schedulers disabled successfully",
  "details": [
    {
      "name": "backupFirebaseDatabase",
      "success": true
    },
    {
      "name": "backupFirebaseStorage",
      "success": true
    }
  ]
}
```

## Cách sử dụng

### Từ Command Line (curl)

```bash
# Xem trạng thái tất cả schedulers
curl http://localhost:3000/scheduler/status

# Tắt backup database scheduler
curl -X POST http://localhost:3000/scheduler/disable/backupFirebaseDatabase

# Bật lại backup database scheduler
curl -X POST http://localhost:3000/scheduler/enable/backupFirebaseDatabase

# Toggle scheduler
curl -X POST http://localhost:3000/scheduler/toggle/backupFirebaseStorage

# Tắt tất cả schedulers
curl -X POST http://localhost:3000/scheduler/disable-all

# Bật tất cả schedulers
curl -X POST http://localhost:3000/scheduler/enable-all
```

### Từ Browser/Postman

Truy cập các endpoints tương ứng:

- GET: `http://localhost:3000/scheduler/status`
- POST: `http://localhost:3000/scheduler/enable/backupFirebaseDatabase`

### Production Environment

Thay `localhost:3000` bằng production URL của bạn.

## Kiến trúc

### Services

1. **SchedulerManagerService** (`src/services/scheduler-manager.service.ts`)

   - Quản lý trạng thái của schedulers
   - Cung cấp methods để enable/disable/toggle schedulers
   - Track last run time và next run time

2. **CronJobsService** (`src/services/cronjobs.service.ts`)
   - Chứa các cron job definitions
   - Kiểm tra enable/disable state trước khi chạy
   - Cập nhật last run time sau khi hoàn thành

### Controllers

**SchedulerController** (`src/controllers/scheduler.controller.ts`)

- Expose REST API endpoints
- Xử lý requests và responses
- Validation và error handling

## Lưu ý

1. **Runtime vs Startup Configuration**:

   - Environment variables chỉ áp dụng khi khởi động ứng dụng
   - REST API cho phép thay đổi trạng thái trong runtime
   - Thay đổi qua API sẽ mất khi restart app (revert về config trong env file)

2. **Permissions**:

   - Các endpoints này nên được bảo vệ bằng authentication/authorization trong production
   - Hiện tại chưa có guard protection

3. **Monitoring**:
   - Check logs để xem scheduler execution
   - Use `/scheduler/status` để monitor real-time state

## Troubleshooting

### Scheduler không chạy

1. Kiểm tra environment variables trong file `.env`:

   ```env
   SCHEDULER_ENABLED=true
   BACKUP_DATABASE_SCHEDULER_ENABLED=true
   ```

2. Kiểm tra trạng thái qua API:

   ```bash
   curl http://localhost:3000/scheduler/status
   ```

3. Xem logs khi app khởi động:
   ```
   [SchedulerManagerService] Scheduler states initialized:
   [SchedulerManagerService]   backupFirebaseDatabase: ENABLED
   ```

### Scheduler bị disable sau khi restart

- Đây là behavior bình thường
- Thay đổi qua API chỉ tồn tại trong runtime
- Để persistent, cập nhật environment variables

## Future Enhancements

- [ ] Persistent state (lưu vào database)
- [ ] Scheduler history và audit logs
- [ ] Manual trigger để chạy scheduler on-demand
- [ ] Cron schedule configuration qua API
- [ ] Authentication/Authorization guards
- [ ] WebSocket notifications khi scheduler runs
