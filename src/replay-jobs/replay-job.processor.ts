import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ReplayJobsRepository } from './replay-jobs.repository';
import { SnapshotsService } from '../snapshots/snapshots.service';
import { REPLAY_JOBS_QUEUE } from '../queues/queue-names';
import type { Prisma } from '../generated/prisma/client';

export interface ReplayJobData {
  jobId: string;
}

interface ReplayJobResult {
  aggregatesProcessed: number;
  snapshotsCreated: number;
  failures: { aggregateId: string; error: string }[];
}

@Processor(REPLAY_JOBS_QUEUE)
export class ReplayJobProcessor extends WorkerHost {
  private readonly logger = new Logger(ReplayJobProcessor.name);

  constructor(
    private readonly replayJobsRepository: ReplayJobsRepository,
    private readonly snapshotsService: SnapshotsService,
  ) {
    super();
  }

  async process(job: Job<ReplayJobData>): Promise<void> {
    const { jobId } = job.data;
    const replayJob = await this.replayJobsRepository.markRunning(jobId);

    const result: ReplayJobResult = {
      aggregatesProcessed: 0,
      snapshotsCreated: 0,
      failures: [],
    };

    try {
      const aggregates =
        await this.replayJobsRepository.findAggregateIdsForScope(
          replayJob.projectId,
          replayJob.aggregateType ?? undefined,
        );

      for (const { id: aggregateId } of aggregates) {
        result.aggregatesProcessed += 1;
        try {
          const snapshot = await this.snapshotsService.createSnapshot(
            replayJob.projectId,
            aggregateId,
          );
          if (snapshot) result.snapshotsCreated += 1;
        } catch (error) {
          result.failures.push({
            aggregateId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      await this.replayJobsRepository.markCompleted(
        jobId,
        result as unknown as Prisma.InputJsonValue,
      );
    } catch (error) {
      this.logger.error(
        `Replay job ${jobId} failed`,
        error instanceof Error ? error.stack : String(error),
      );
      await this.replayJobsRepository.markFailed(
        jobId,
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }
}
