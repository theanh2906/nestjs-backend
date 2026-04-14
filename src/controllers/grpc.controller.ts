import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { GrpcService, SystemService } from '../services';

/**
 * Controller for handling gRPC requests.
 */
@Controller()
export class GrpcController {
  @Inject() grpcService: GrpcService;
  @Inject() systemService: SystemService;

  /**
   * gRPC method to say hello.
   * @param data The data containing the name.
   * @returns A greeting message.
   */
  @GrpcMethod('GreeterService', 'SayHello')
  sayHello(data: { name: string }): { message: string } {
    return this.grpcService.sayHello(data.name);
  }

  /**
   * gRPC method to get system information.
   * @returns The system monitoring information.
   */
  @GrpcMethod('MonitorService', 'GetSystemInfo')
  async getSystemInfo() {
    return {
      data: JSON.stringify(await this.systemService.getMonitoringInfo()),
    };
  }
}
