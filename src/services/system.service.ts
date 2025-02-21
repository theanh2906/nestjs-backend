import { Injectable } from '@nestjs/common';
import { UtilsService } from '../shared/utils.service';
import * as os from 'os';

export interface SystemMonitoringInfo {
  used_memory: string;
  free_memory: string;
  total_memory: string;
  used_memory_percentage: string;
  uptime: string;
  raw_data: {
    used_memory: number;
    free_memory: number;
    total_memory: number;
  };
}

@Injectable()
export class SystemService {
  constructor(private readonly utils: UtilsService) {}

  getMonitoringInfo = (): SystemMonitoringInfo => ({
    used_memory: this.utils.convertCapacity(os.totalmem() - os.freemem()),
    free_memory: this.utils.convertCapacity(os.freemem()),
    total_memory: this.utils.convertCapacity(os.totalmem()),
    used_memory_percentage: this.utils.calculatePercentage(
      os.totalmem() - os.freemem(),
      os.totalmem(),
    ),
    uptime: this.utils.convertTime(os.uptime()),
    raw_data: {
      used_memory: os.totalmem() - os.freemem(),
      free_memory: os.freemem(),
      total_memory: os.totalmem(),
    },
  });
}
