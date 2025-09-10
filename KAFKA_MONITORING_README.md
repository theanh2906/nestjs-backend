# Kafka Monitoring System

This comprehensive Kafka monitoring system provides real-time monitoring of your Kafka cluster with detailed metrics, alerting, and a modern web interface.

## 🚀 Features

### Backend Monitoring Service

- **Real-time Monitoring**: Monitors Kafka cluster every 30 seconds
- **Comprehensive Metrics**:
  - Cluster health and broker status
  - Topic information with partition details
  - Consumer group lag monitoring
  - Performance metrics (throughput, latency, error rates)
- **Smart Alerting**: Configurable alerts for various conditions
- **SSE Integration**: Real-time updates via Server-Sent Events
- **REST API**: Full REST API for monitoring data access

### Frontend Dashboard

- **Tabbed Interface**: Separate tabs for device monitoring and Kafka monitoring
- **Interactive Charts**: Real-time performance charts with Chart.js
- **Detailed Tables**:
  - Topics with partition information
  - Consumer groups with lag details
  - Broker status and health
  - Partition leadership and replication status
- **Metric Cards**: Key performance indicators at a glance
- **Alert Panel**: Real-time alerts with severity levels
- **Responsive Design**: Mobile-friendly interface

## 📋 Prerequisites

- Node.js 18+
- Docker and Docker Compose
- NestJS application with existing SSE service
- Angular application with PrimeNG components

## 🛠️ Backend Setup

### 1. Install Dependencies

The required dependencies should already be installed in your NestJS project:

- `kafkajs` - Kafka client
- `@nestjs/schedule` - Cron jobs for monitoring

### 2. Environment Configuration

Update your environment file (`src/environments/local.env`):

```env
# Kafka Configuration
KAFKA_ENABLED=true
KAFKA_GROUP_ID=nestjs-backend-group
KAFKA_TOPIC=nestjs-backend-topic
KAFKA_CLIENT_ID=nestjs-backend
KAFKA_BROKERS=localhost:9092
KAFKA_SSL=false
KAFKA_SASL_USERNAME=
KAFKA_SASL_PASSWORD=
KAFKA_SASL_MECHANISM=plain

# Kafka Monitoring Configuration
KAFKA_MONITOR_ENABLED=true
KAFKA_MONITOR_INTERVAL_SECONDS=30
KAFKA_MONITOR_PERFORMANCE_SAMPLES=100
```

### 3. Start Kafka Cluster

Use the provided Docker Compose file:

```bash
# Start Kafka cluster
docker-compose -f kafka-docker-compose.yml up -d

# Check if services are running
docker-compose -f kafka-docker-compose.yml ps

# View logs
docker-compose -f kafka-docker-compose.yml logs -f kafka
```

### 4. Create Test Topics (Optional)

```bash
# Create a test topic
docker exec kafka-broker kafka-topics --create --topic test-topic --bootstrap-server localhost:9092 --partitions 3 --replication-factor 1

# List all topics
docker exec kafka-broker kafka-topics --list --bootstrap-server localhost:9092
```

### 5. Start the NestJS Application

```bash
npm run dev
```

## 🎨 Frontend Setup

### 1. Required Dependencies

Ensure these PrimeNG modules are available in your Angular project:

- `primeng/tabview`
- `primeng/chart`
- `primeng/progressbar`
- `primeng/divider`

### 2. Chart.js Setup

If not already installed, add Chart.js:

```bash
npm install chart.js
```

## 📊 API Endpoints

### Kafka Monitoring Endpoints

| Endpoint                        | Method    | Description                        |
| ------------------------------- | --------- | ---------------------------------- |
| `/kafka-monitor/status`         | GET       | Get current Kafka cluster status   |
| `/kafka-monitor/health`         | GET       | Get Kafka health check             |
| `/kafka-monitor/config`         | GET       | Get Kafka configuration            |
| `/kafka-monitor/trigger-report` | POST      | Manually trigger monitoring report |
| `/kafka-monitor/events`         | GET (SSE) | Subscribe to monitoring events     |

### Example API Responses

#### Cluster Status Response

```json
{
  "status": "success",
  "data": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "status": "online",
    "cluster": {
      "clusterId": "kafka-cluster",
      "totalBrokers": 1,
      "totalTopics": 5,
      "totalPartitions": 15,
      "totalConsumerGroups": 2
    },
    "topics": [
      {
        "name": "test-topic",
        "totalPartitions": 3,
        "replicationFactor": 1,
        "partitions": [...]
      }
    ],
    "consumerGroups": [
      {
        "groupId": "test-group",
        "state": "Stable",
        "lag": 0,
        "members": [...]
      }
    ],
    "performance": {
      "avgProduceTime": 5.2,
      "avgConsumeTime": 3.1,
      "messagesPerSecond": 150.5,
      "bytesPerSecond": 15350,
      "errorRate": 0.1
    },
    "alerts": [],
    "errors": []
  }
}
```

## 🚨 Monitoring Features

### Alert Types

The system monitors and alerts on:

- **High Consumer Lag**: When consumer groups fall behind
- **Low Replication Factor**: Topics with insufficient replication
- **High Error Rate**: When error rates exceed thresholds
- **Performance Issues**: High produce/consume times
- **Broker Health**: Offline or unhealthy brokers

### Performance Metrics

- **Messages per Second**: Real-time throughput monitoring
- **Bytes per Second**: Data transfer rates
- **Average Latency**: Produce and consume latencies
- **Error Rate**: Percentage of failed operations
- **Consumer Lag**: How far behind consumers are

### Chart Visualizations

- **Real-time Performance Charts**: Line charts showing metrics over time
- **Alert Timeline**: Visual representation of alerts
- **Metric History**: Historical performance data

## 🎛️ Configuration Options

### Alert Thresholds

You can customize alert thresholds in the `KafkaMonitorService`:

```typescript
// High lag threshold (messages)
const HIGH_LAG_THRESHOLD = 10000;
const MODERATE_LAG_THRESHOLD = 1000;

// Performance thresholds
const HIGH_PRODUCE_TIME_THRESHOLD = 1000; // ms
const HIGH_CONSUME_TIME_THRESHOLD = 1000; // ms
const HIGH_ERROR_RATE_THRESHOLD = 5; // percentage
```

### Monitoring Intervals

Adjust monitoring frequency in your environment variables:

```env
KAFKA_MONITOR_INTERVAL_SECONDS=30  # Monitor every 30 seconds
KAFKA_MONITOR_PERFORMANCE_SAMPLES=100  # Keep 100 performance samples
```

## 📱 Frontend Interface

### Monitor Dashboard

The monitoring interface includes:

1. **Device Monitoring Tab**: Existing device monitoring functionality
2. **Kafka Monitoring Tab**: New Kafka-specific monitoring with:
   - Status header with connection status
   - Metric cards showing key performance indicators
   - Real-time alerts panel
   - Performance charts
   - Detailed tables for topics, consumer groups, brokers, and partitions

### Responsive Design

The interface is fully responsive and adapts to:

- Desktop displays
- Tablet devices
- Mobile phones

## 🔧 Troubleshooting

### Common Issues

1. **Kafka Connection Failed**

   - Check if Kafka broker is running: `docker ps`
   - Verify broker address in environment variables
   - Check network connectivity

2. **No Monitoring Data**

   - Ensure `KAFKA_ENABLED=true` in environment
   - Check application logs for errors
   - Verify SSE connection in browser dev tools

3. **Chart Not Displaying**
   - Ensure Chart.js is properly installed
   - Check browser console for JavaScript errors
   - Verify chart data structure

### Debugging

Enable debug logging:

```typescript
// In KafkaMonitorService
private readonly logger = new Logger(KafkaMonitorService.name);

// Set log level to debug in main.ts
app.useLogger(['error', 'warn', 'log', 'debug']);
```

### Kafka UI Access

Access the Kafka UI for additional debugging:

- URL: http://localhost:8080
- View topics, partitions, and consumer groups
- Monitor broker health and configuration

## 🚀 Production Deployment

### Environment Variables for Production

```env
# Production Kafka Configuration
KAFKA_ENABLED=true
KAFKA_BROKERS=kafka-broker-1:9092,kafka-broker-2:9092,kafka-broker-3:9092
KAFKA_SSL=true
KAFKA_SASL_USERNAME=your-username
KAFKA_SASL_PASSWORD=your-password
KAFKA_SASL_MECHANISM=SCRAM-SHA-512

# Monitoring Configuration
KAFKA_MONITOR_ENABLED=true
KAFKA_MONITOR_INTERVAL_SECONDS=30
```

### Security Considerations

- Use SSL/TLS for Kafka connections in production
- Implement proper authentication (SASL)
- Secure API endpoints with authentication
- Use environment variables for sensitive configuration

### Performance Optimization

- Adjust monitoring intervals based on cluster size
- Implement proper error handling and circuit breakers
- Use connection pooling for high-throughput scenarios
- Monitor memory usage and adjust sample sizes

## 📈 Metrics Reference

### Cluster Metrics

- Total brokers, topics, partitions
- Controller information
- Cluster health status

### Topic Metrics

- Partition count and distribution
- Replication factor
- Message counts and sizes
- Retention policies

### Consumer Group Metrics

- Group state and membership
- Consumer lag by partition
- Coordinator information
- Offset management

### Performance Metrics

- Throughput (messages/second, bytes/second)
- Latency (produce time, consume time)
- Error rates and counts
- Resource utilization

## 🤝 Contributing

To extend the monitoring system:

1. Add new metrics in `KafkaMonitorService`
2. Update the data models in both backend and frontend
3. Extend the UI components for new visualizations
4. Add appropriate alert rules
5. Update documentation

## 📝 License

This monitoring system is part of your existing project and follows the same license terms.
