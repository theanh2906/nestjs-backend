import { Module } from '@nestjs/common';
import { FirebaseService } from './services/firebase.service';
import { UtilsService } from './shared/utils.service';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';
import { SystemService } from './services/system.service';

const services = [FirebaseService, UtilsService, SystemService];

@Module({
  imports: [HttpModule, CacheModule.register()],
  providers: services,
  exports: services,
})
export class ServicesModule {}
