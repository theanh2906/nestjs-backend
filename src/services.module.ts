import { Module } from '@nestjs/common';
import { AppService } from './app.service';
import { FirebaseService } from './services/firebase.service';
import { UtilsService } from './shared/utils.service';
import { HttpModule } from '@nestjs/axios';
import { CacheModule } from '@nestjs/cache-manager';

@Module({
  imports: [HttpModule, CacheModule.register()],
  providers: [AppService, FirebaseService, UtilsService],
  exports: [AppService, FirebaseService, UtilsService],
})
export class ServicesModule {}
