import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SNAPSHOT_CREATION_QUEUE, REPLAY_JOBS_QUEUE } from './queue-names';

@Module({
  imports: [
    BullModule.forRoot({
      connection: { url: process.env.REDIS_URL },
    }),
    BullModule.registerQueue(
      { name: SNAPSHOT_CREATION_QUEUE },
      { name: REPLAY_JOBS_QUEUE },
    ),
  ],
  exports: [BullModule],
})
export class QueuesModule {}
