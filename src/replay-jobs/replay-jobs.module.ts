import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ReplayJobsController } from './replay-jobs.controller';
import { ReplayJobsService } from './replay-jobs.service';
import { ReplayJobsRepository } from './replay-jobs.repository';
import { ReplayJobProcessor } from './replay-job.processor';
import { PrismaModule } from '../prisma/prisma.module';
import { ApiKeyModule } from '../api-keys/api-keys.module';
import { SnapshotsModule } from '../snapshots/snapshots.module';
import { QueuesModule } from '../queues/queues.module';
import { REPLAY_JOBS_QUEUE } from '../queues/queue-names';
import { ApiKeyGuard } from '../common/auth/api-key.guard';
import { ProjectAccessGuard } from '../common/auth/project-access.guard';

@Module({
  imports: [
    PrismaModule,
    ApiKeyModule,
    SnapshotsModule,
    QueuesModule,
    BullModule.registerQueue({ name: REPLAY_JOBS_QUEUE }),
  ],
  controllers: [ReplayJobsController],
  providers: [
    ReplayJobsService,
    ReplayJobsRepository,
    ReplayJobProcessor,
    ApiKeyGuard,
    ProjectAccessGuard,
  ],
  exports: [ReplayJobsService],
})
export class ReplayJobsModule {}
