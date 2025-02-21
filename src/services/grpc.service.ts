import { Injectable } from '@nestjs/common';

export interface GreeterServiceGrpc {
  sayHello(data: { name: string }): { message: string };
}

@Injectable()
export class GrpcService {
  private greeterService: GreeterServiceGrpc;
  sayHello(name: string) {
    return { message: `Hello ${name}` };
  }
}
