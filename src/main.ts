import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: ['http://localhost:4200', 'https://benna.vercel.app'],
      methods: ['GET', 'POST', 'PATCH', 'PUT'],
    },
  });
  /**
   * Connect microservice
   */
  // app.connectMicroservice<MicroserviceOptions>({
  //   transport: Transport.GRPC,
  //   options: {
  //     package: 'monitor',
  //     protoPath: join(__dirname, 'proto/monitor/monitor.proto'),
  //   },
  // });
  /**
   * Versioning
   */
  // app.enableVersioning({
  //   type: VersioningType.URI,
  // });
  // app.set('trust proxy', 'loopback');
  /**
   * Start microservice
   */
  // await app.startAllMicroservices();
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
