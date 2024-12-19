import { Injectable } from '@nestjs/common';
import { TimeUnitEnum, UnitEnum } from './constants';
import { GetFilesResponse } from '@google-cloud/storage';

@Injectable()
export class UtilsService {
  // convertTime(dateString: string) {
  //   const [day, month, year] = dateString.split('-').map(Number);
  //   return new Date(day, month - 1, year).getTime();
  // }

  calculatePercentage(numerator: number, denominator: number, fix = 2) {
    return ((numerator / denominator) * 100).toFixed(fix) + '%';
  }

  convertCapacity(value: number, fixed = 2) {
    if (!value) {
      return '-';
    }
    const unitMap = [
      { unit: UnitEnum.TB, factor: 1024 ** 4 },
      { unit: UnitEnum.GB, factor: 1024 ** 3 },
      { unit: UnitEnum.MB, factor: 1024 ** 2 },
      { unit: UnitEnum.KB, factor: 1024 },
      { unit: UnitEnum.B, factor: 1 },
    ];
    // Iterate through units starting from the largest (TB) and find the best fit
    for (const { unit, factor } of unitMap) {
      if (value >= factor) {
        const convertedValue = (value / factor).toFixed(fixed); // Convert value and round to 2 decimal places
        return `${convertedValue} ${unit}`;
      }
    }

    return `${value} ${UnitEnum.B}`; // Default to bytes if no units fit
  }

  convertTime(seconds: number): string {
    // Define unit conversion factors in seconds
    const timeUnits = [
      { unit: TimeUnitEnum.WEEKS, value: 604800 }, // 1 week = 604800 seconds
      { unit: TimeUnitEnum.DAYS, value: 86400 }, // 1 day = 86400 seconds
      { unit: TimeUnitEnum.HOURS, value: 3600 }, // 1 hour = 3600 seconds
      { unit: TimeUnitEnum.MINUTES, value: 60 }, // 1 minute = 60 seconds
      { unit: TimeUnitEnum.SECONDS, value: 1 }, // 1 second = 1 second
    ];

    let remainingSeconds = seconds;
    const result = [];

    for (const { unit, value } of timeUnits) {
      if (remainingSeconds >= value) {
        const count = Math.floor(remainingSeconds / value);
        remainingSeconds %= value;
        result.push(`${count}${unit}`);
      }
    }

    return result.join('');
  }

  formatStoragePayload(filesResponse: GetFilesResponse) {
    const files = filesResponse[0];
    return files
      .map((file) => ({
        name: file.name,
        size: this.convertCapacity(+file.metadata.size),
        isFile: file.metadata.size !== '0',
        isDirectory: file.metadata.size == '0',
        createdAt: file.metadata.timeCreated,
        modifiedAt: file.metadata.updated,
      }))
      .sort((a, b) => +b.isDirectory - +a.isDirectory);
  }
}
