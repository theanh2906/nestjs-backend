import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DataModificationInterceptor } from './interceptors/data-modification.interceptor';
import { AppGateway } from './app.gateway';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    },
    snapshot: true,
  });
  // const configService = app.get(ConfigService);
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
  app.useGlobalInterceptors(
    new DataModificationInterceptor(app.get(AppGateway)),
  );
  await app.listen(process.env.PORT ?? 3000);
  // const _firebaseApp = initializeApp({
  //   projectId: configService.get('FIREBASE_PROJECT_ID'),
  //   databaseURL: configService.get('FIREBASE_DATABASE_URL'),
  //   storageBucket: configService.get('FIREBASE_STORAGE_BUCKET'),
  //   credential: credential.cert(serviceAccount as ServiceAccount),
  // });
}

bootstrap();
