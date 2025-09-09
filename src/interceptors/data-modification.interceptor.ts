import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { AppGateway } from '../app.gateway';
import type { Response } from 'express';

@Injectable()
export class DataModificationInterceptor implements NestInterceptor {
  constructor(private readonly gateway: AppGateway) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<any> | Promise<Observable<any>> {
    const response = context.switchToHttp().getResponse<Response>();
    const request = context.switchToHttp().getRequest();
    // response.setHeader(
    //   'Content-Security-Policy',
    //   "frame-ancestors 'self' https://benna.vercel.app"
    // );
    return next.handle();
  }
}
