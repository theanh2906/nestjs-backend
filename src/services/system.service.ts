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
    usedMemoryInPercentage: this.utils.calculatePercentage(
      os.totalmem() - os.freemem(),
      os.totalmem(),
    ),
    uptime: this.utils.convertTime(os.uptime()),
    rawData: {
      usedMemory: os.totalmem() - os.freemem(),
      freeMemory: os.freemem(),
      totalMemory: os.totalmem(),
    },
  });
}
