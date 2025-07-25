import { Inject, Injectable } from '@nestjs/common';
import { UtilsService } from '../shared/utils.service';
import * as os from 'node:os';
import { exec } from 'node:child_process';

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
    public_ip: string;
  };
}

@Injectable()
export class SystemService {
  @Inject() private readonly utils: UtilsService;

  getMonitoringInfo = async () => ({
    device_name: os.hostname(),
    data: JSON.stringify({
      used_memory: this.utils.calculatePercentage(
        os.totalmem() - os.freemem(),
        os.totalmem()
      ),
      uptime: this.utils.convertTime(os.uptime()),
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
    }),
    timestamp: Date.now(),
  });

  executeCommand = (command: string): Promise<string> =>
    new Promise((resolve, reject) => {
      exec(command, (error, stdout, stderr) => {
        if (error) {
          // Include error message and stderr in the rejection
          reject(`${error.message}`);
        } else {
          // Include both stdout and stderr in the response
          resolve(`${stdout}${stderr ? '\n' + stderr : ''}`);
        }
      });
    });
}
