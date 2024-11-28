import { Module } from '@nestjs/common';
import { FilesController } from './controllers/files.controller';
import { HealthController } from './health/health.controller';
import { TerminusModule } from '@nestjs/terminus';

const controllers = [FilesController, HealthController];

@Module({
  imports: [TerminusModule],
  providers: controllers,
  controllers: controllers,
  exports: controllers,
})
export class ControllersModule {}
