import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DataModificationInterceptor } from '../src/interceptors/data-modification.interceptor';
import { AppGateway } from '../src/app.gateway';
import { setDefaultResultOrder } from 'dns';

setDefaultResultOrder('ipv4first');

let cachedServer: any;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    },
  });

  // Replicate main.ts logic for interceptors
  app.useGlobalInterceptors(
    new DataModificationInterceptor(app.get(AppGateway))
  );

  // We do NOT call app.startAllMicroservices() or app.listen() here
  // Vercel handles the listening part
  await app.init();
  return app.getHttpAdapter().getInstance();
}

export default async (req: any, res: any) => {
  if (!cachedServer) {
    cachedServer = await bootstrap();
  }
  return cachedServer(req, res);
};
