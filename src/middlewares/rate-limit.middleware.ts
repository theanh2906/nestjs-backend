import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NestMiddleware,
} from '@nestjs/common';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly REQUEST_LIMIT = 10; // Maximum requests per minute
  private readonly TIME_WINDOW = 60; // Time window in seconds
  private readonly logger = new Logger(RateLimitMiddleware.name);

  constructor(@Inject(CACHE_MANAGER) private readonly cacheManager: Cache) {}

  async use(req: any, _: any, next: (error?: any) => void): Promise<any> {
    const userIp = req.ip;
    let requestCount = await this.cacheManager.get<number>(
      `${userIp}-ratelimit`,
    );
    if (requestCount == undefined) {
      this.cacheManager.set(`${userIp}-ratelimit`, 0, this.TIME_WINDOW);
      requestCount = await this.cacheManager.get<number>(`${userIp}-ratelimit`);
    }
    if (requestCount >= this.REQUEST_LIMIT) {
      throw new BadRequestException();
    }

    await this.cacheManager.set(`${userIp}-ratelimit`, requestCount + 1);

    next();
  }
}
