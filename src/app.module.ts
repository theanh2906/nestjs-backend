import { Module } from '@nestjs/common';
import { AppGateway } from './app.gateway';
import { HttpModule } from '@nestjs/axios';
import { ServicesModule } from './services.module';
import { AppController } from './app.controller';
import { CacheInterceptor, CacheModule } from '@nestjs/cache-manager';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { RateLimitGuards } from './guards/rate-limit.guards';
import { ControllersModule } from './controllers.module';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import * as process from 'node:process';

@Module({
  imports: [
    HttpModule,
    ServicesModule,
    CacheModule.register(),
    ConfigModule.forRoot({
      envFilePath: `src/environments/${process.env.NODE_ENV}.env`,
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 10,
      },
    ]),
    ControllersModule,
  ],
  controllers: [AppController],
  providers: [
    AppGateway,
    AppService,
    { provide: APP_INTERCEPTOR, useClass: CacheInterceptor },
    { provide: APP_GUARD, useClass: RateLimitGuards },
  ],
})
export class AppModule {
  /**
   * Config rate limit using cache. Should implement NestModule
   * @type any
   */
  // configure(consumer: MiddlewareConsumer) {
  //   consumer.apply(RateLimitMiddleware).forRoutes('*');
  // }
}
