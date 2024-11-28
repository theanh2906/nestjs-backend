import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { SystemService } from './services/system.service';
import { SkipThrottle } from '@nestjs/throttler';
import { AppGateway } from './app.gateway';

@Controller()
export class AppController {
  private readonly REQUEST_LIMIT = 10;

  constructor(
    private readonly appService: AppService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly systemService: SystemService,
    private readonly appGateway: AppGateway,
  ) {
    this.appService.startMonitoring();
  }

  @Get()
  @SkipThrottle()
  getHello(): any {
    return this.systemService.getMonitoringInfo();
  }
}
