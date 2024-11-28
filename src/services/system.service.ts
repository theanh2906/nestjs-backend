import { Injectable } from '@nestjs/common';
import { UtilsService } from '../shared/utils.service';
import * as os from 'os';

@Injectable()
export class SystemService {
  constructor(private readonly utils: UtilsService) {}

  getMonitoringInfo = () => ({
    usedMemory: this.utils.convertCapacity(os.totalmem() - os.freemem()),
    freeMemory: this.utils.convertCapacity(os.freemem()),
    totalMemory: this.utils.convertCapacity(os.totalmem()),
    memoryUsed: this.utils.calculatePercentage(
      os.totalmem() - os.freemem(),
      os.totalmem(),
    ),
    uptime: this.utils.convertTime(os.uptime()),
  });
}
