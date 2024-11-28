import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  /**
   * Versioning
   */
  // app.enableVersioning({
  //   type: VersioningType.URI,
  // });
  // app.set('trust proxy', 'loopback');
  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
