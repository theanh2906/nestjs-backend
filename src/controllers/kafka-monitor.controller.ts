import {
  Controller,
  Get,
  Inject,
  Logger,
  Post,
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SseService } from '../services/sse.service';
import { KafkaMonitorService } from '../services/kafka-monitor.service';
import { SseEvent } from '../shared/types';
import { RateLimitGuards } from '../guards/rate-limit.guards';

export interface SseMessage {
  data: string;
  id?: string;
  type?: string;
  retry?: number;
}

@Controller('/api/kafka-monitor')
@UseGuards(RateLimitGuards)
export class KafkaMonitorController {
  private readonly logger = new Logger(KafkaMonitorController.name);

  constructor(
    private readonly kafkaMonitorService: KafkaMonitorService,
    private readonly sseService: SseService,
    @Inject('KAFKA_CONFIG') private readonly kafkaConfig: any
  ) {}

  @Get('status')
  async getKafkaStatus() {
    try {
      if (!this.kafkaConfig.KAFKA_ENABLED) {
        return {
          status: 'disabled',
          message: 'Kafka monitoring is disabled',
          timestamp: new Date(),
        };
      }

      const report = await this.kafkaMonitorService.triggerMonitoringReport();
      return {
        status: 'success',
        data: report,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get Kafka status', error);
      return {
        status: 'error',
        message: error.message,
        timestamp: new Date(),
      };
    }
  }

  @Post('trigger-report')
  async triggerReport() {
    try {
      if (!this.kafkaConfig.KAFKA_ENABLED) {
        return {
          status: 'disabled',
          message: 'Kafka monitoring is disabled',
        };
      }

      const report = await this.kafkaMonitorService.triggerMonitoringReport();

      // Send the report via SSE
      this.sseService.emit(
        SseEvent.MonitorReport,
        JSON.stringify({
          type: 'kafka-monitor',
          device_name: 'kafka-cluster',
          timestamp: new Date(),
          data: JSON.stringify(report),
        })
      );

      return {
        status: 'success',
        message: 'Kafka monitoring report triggered and sent via SSE',
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to trigger Kafka monitoring report', error);
      return {
        status: 'error',
        message: error.message,
        timestamp: new Date(),
      };
    }
  }

  @Get('health')
  async getHealthStatus() {
    try {
      if (!this.kafkaConfig.KAFKA_ENABLED) {
        return {
          status: 'disabled',
          kafka_enabled: false,
          timestamp: new Date(),
        };
      }

      const health =
        await this.kafkaMonitorService['kafkaService'].healthCheck();
      return {
        status: 'success',
        kafka_enabled: true,
        health,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get Kafka health status', error);
      return {
        status: 'error',
        kafka_enabled: this.kafkaConfig.KAFKA_ENABLED,
        message: error.message,
        timestamp: new Date(),
      };
    }
  }

  @Sse('events')
  monitoringEvents(): Observable<SseMessage> {
    this.logger.log('Client subscribed to Kafka monitoring SSE events');

    return this.sseService
      .getEvent(SseEvent.MonitorReport)
      .pipe(
        map((data) => {
          try {
            // Parse the data to ensure it's a Kafka monitoring event
            const parsedData =
              typeof data === 'string' ? JSON.parse(data) : data;

            if (parsedData.type === 'kafka-monitor') {
              return {
                data: JSON.stringify(parsedData),
                type: 'kafka-monitor',
                id: Date.now().toString(),
              } as SseMessage;
            }

            // If it's not a Kafka monitoring event, skip it
            return null;
          } catch (error) {
            this.logger.error(
              'Error parsing SSE data for Kafka monitoring',
              error
            );
            return {
              data: JSON.stringify({
                type: 'error',
                message: 'Failed to parse monitoring data',
                timestamp: new Date(),
              }),
              type: 'error',
              id: Date.now().toString(),
            } as SseMessage;
          }
        })
      )
      .pipe(
        // Filter out null values
        map((message) => message as SseMessage)
      );
  }

  @Get('config')
  getKafkaConfig() {
    return {
      enabled: this.kafkaConfig.KAFKA_ENABLED,
      brokers: this.kafkaConfig.KAFKA_BROKERS,
      clientId: this.kafkaConfig.KAFKA_CLIENT_ID,
      ssl: this.kafkaConfig.KAFKA_SSL,
      timestamp: new Date(),
    };
  }
}
