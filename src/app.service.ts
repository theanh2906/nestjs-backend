import { Injectable } from '@nestjs/common';
import { AppGateway } from './app.gateway';
import { SystemService } from './services/system.service';

@Injectable()
export class AppService {
  constructor(
    private readonly gateway: AppGateway,
    private readonly systemService: SystemService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  startMonitoring() {
    setInterval(() => {
      this.gateway.sendMessage(
        'monitor',
        JSON.stringify(this.systemService.getMonitoringInfo()),
      );
    }, 2000);
  }
}
