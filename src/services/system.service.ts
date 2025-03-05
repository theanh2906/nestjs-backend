import { Inject, Injectable } from '@nestjs/common';
import { UtilsService } from '../shared/utils.service';
import * as os from 'node:os';

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
  system_info: {
    os: string;
    model: string;
    cpu: {
      model: string;
      speed: number;
      cores: number;
    };
    user: string;
  };
}

@Injectable()
export class SystemService {
  @Inject() private readonly utils: UtilsService;

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
    system_info: {
      os: os.version(),
      model: os.hostname(),
      cpu: {
        model: os.cpus()[0].model,
        speed: os.cpus()[0].speed,
        cores: os.cpus().length,
      },
      user: os.userInfo().username,
    },
  });
}
