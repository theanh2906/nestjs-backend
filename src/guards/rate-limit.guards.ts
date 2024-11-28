import { ThrottlerGuard } from '@nestjs/throttler';
import { ExecutionContext, Logger } from '@nestjs/common';

export class RateLimitGuards extends ThrottlerGuard {
  protected readonly logger = new Logger(RateLimitGuards.name);

  canActivate(context: ExecutionContext): Promise<boolean> {
    return super.canActivate(context);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    console.log(req.ip);
    return req.ips.length ? req.ips[0] : req.ip;
  }
}
