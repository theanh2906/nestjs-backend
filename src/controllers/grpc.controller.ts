import { Controller, Inject } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { GrpcService } from '../services/grpc.service';
import { SystemService } from '../services/system.service';

@Controller()
export class GrpcController {
  @Inject() grpcService: GrpcService;
  @Inject() systemService: SystemService;
  @GrpcMethod('GreeterService', 'SayHello')
  sayHello(data: { name: string }): { message: string } {
    return this.grpcService.sayHello(data.name);
  }

  @GrpcMethod('MonitorService', 'GetSystemInfo')
  getSystemInfo() {
    return {
      data: JSON.stringify(this.systemService.getMonitoringInfo()),
    };
  }
}
