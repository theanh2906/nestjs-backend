import { Logger } from '@nestjs/common';

export class AppLogger {
  protected readonly logger = new Logger(this.constructor.name);
}
