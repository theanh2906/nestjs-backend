import { Module } from '@nestjs/common';
import { EventsController } from './controllers/events.controller';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController, EventsController],
  exports: [AppController, EventsController],
})
export class ControllersModule {}
