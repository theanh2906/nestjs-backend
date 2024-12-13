import { Controller, Get, Inject } from '@nestjs/common';
import { AppService } from './app.service';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { SystemService } from './services/system.service';
import { SkipThrottle } from '@nestjs/throttler';
import { BaseController } from './shared/base.controller';
import { NotesService } from './services/notes.service';

@Controller()
export class AppController extends BaseController {
  private readonly REQUEST_LIMIT = 10;

  constructor(
    private readonly appService: AppService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
    private readonly systemService: SystemService,
    private readonly notesService: NotesService,
  ) {
    super();
  }

  @Get()
  @SkipThrottle()
  getHello(): any {
    return this.systemService.getMonitoringInfo();
  }
}
