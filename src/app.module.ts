import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppGateway } from './app.gateway';
import { HttpModule } from '@nestjs/axios';
import { ServicesModule } from './services.module';
import { AppController } from './app.controller';
import { CacheInterceptor, CacheModule } from '@nestjs/cache-manager';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RateLimitMiddleware } from './middlewares/rate-limit.middleware';

@Module({
  imports: [HttpModule, ServicesModule, CacheModule.register()],
  controllers: [AppController],
  providers: [
    AppGateway,
    { provide: APP_INTERCEPTOR, useClass: CacheInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RateLimitMiddleware).forRoutes('*');
  }
}
