import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SyncService } from './sync.service';
import { SyncProcessor } from './sync.processor';
import { SyncController } from './sync.controller';
import { MetaModule } from '../meta/meta.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'meta-sync',
      defaultJobOptions: {
        removeOnComplete: true,
      },
    }),
    MetaModule,
  ],
  providers: [SyncService, SyncProcessor],
  controllers: [SyncController],
  exports: [SyncService],
})
export class SyncModule {}
