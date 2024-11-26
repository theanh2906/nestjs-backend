import { Injectable } from '@nestjs/common';

@Injectable()
export class UtilsService {
  convertTime(dateString: string) {
    const [day, month, year] = dateString.split('-').map(Number);
    return new Date(day, month - 1, year).getTime();
  }
}
