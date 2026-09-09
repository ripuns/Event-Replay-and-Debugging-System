import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SnapshotsService } from './snapshots.service';
import { SnapshotsRepository } from './snapshots.repository';
import { SnapshotCreationProcessor } from './snapshot-creation.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { AggregatesModule } from '../aggregates/aggregates.module';
import { QueuesModule } from '../queues/queues.module';
import { SNAPSHOT_CREATION_QUEUE } from '../queues/queue-names';

@Module({
  imports: [
    PrismaModule,
    AggregatesModule,
    QueuesModule,
    BullModule.registerQueue({ name: SNAPSHOT_CREATION_QUEUE }),
  ],
  providers: [SnapshotsService, SnapshotsRepository, SnapshotCreationProcessor],
  exports: [SnapshotsService, BullModule],
})
export class SnapshotsModule {}
