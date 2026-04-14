import { Injectable } from '@nestjs/common';

export interface GreeterServiceGrpc {
  sayHello(data: { name: string }): { message: string };
}

/**
 * Service for handling gRPC requests.
 */
@Injectable()
export class GrpcService {
  private greeterService: GreeterServiceGrpc;

  /**
   * Returns a greeting message.
   * @param name The name to greet.
   * @returns A greeting message.
   */
  sayHello(name: string) {
    return { message: `Hello ${name}` };
  }
}
