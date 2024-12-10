import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { SystemService } from './services/system.service';
import { SkipThrottle } from '@nestjs/throttler';
import { EventsService } from './services/events.service';
import { BaseController } from './shared/base.controller';

@Controller()
export class AppController extends BaseController {
  private readonly REQUEST_LIMIT = 10;

  constructor(
    private readonly appService: AppService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly systemService: SystemService,
    private readonly eventsService: EventsService,
  ) {
    super();
    this.appService.startMonitoring();
    this.eventsService.fetchData().then((res) => this.logger.log(res));
  }

  @Get()
  @SkipThrottle()
  getHello(): any {
    return this.systemService.getMonitoringInfo();
  }
}
