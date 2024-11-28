import { Module } from '@nestjs/common';
import { FilesController } from './controllers/files.controller';
import { HealthController } from './health/health.controller';
import { TerminusModule } from '@nestjs/terminus';
import { ServicesModule } from './services.module';

const controllers = [FilesController, HealthController];

@Module({
  imports: [TerminusModule, ServicesModule],
  providers: controllers,
  controllers: controllers,
  exports: controllers,
})
export class ControllersModule {}
