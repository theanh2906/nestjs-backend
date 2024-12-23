import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { AppGateway } from '../app.gateway';

@Injectable()
export class DataModificationInterceptor implements NestInterceptor {
  constructor(private readonly gateway: AppGateway) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<any> | Promise<Observable<any>> {
    const response = context.switchToHttp().getResponse();
    const request = context.switchToHttp().getRequest();
    const method = request.method;
    return next.handle().pipe(
      tap(() => {
        if (
          (method === 'POST' || method === 'PUT' || method === 'DELETE') &&
          [200, 201].includes(response.statusCode)
        ) {
          this.gateway.sendMessage('data-update', 'update');
        }
      }),
    );
  }
}
