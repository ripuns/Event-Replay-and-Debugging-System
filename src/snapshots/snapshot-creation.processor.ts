import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { SnapshotsService } from './snapshots.service';
import { SNAPSHOT_CREATION_QUEUE } from '../queues/queue-names';

export interface SnapshotCreationJobData {
  projectId: string;
  aggregateId: string;
}

@Processor(SNAPSHOT_CREATION_QUEUE)
export class SnapshotCreationProcessor extends WorkerHost {
  private readonly logger = new Logger(SnapshotCreationProcessor.name);

  constructor(private readonly snapshotsService: SnapshotsService) {
    super();
  }

  async process(job: Job<SnapshotCreationJobData>): Promise<void> {
    const { projectId, aggregateId } = job.data;

    try {
      await this.snapshotsService.createSnapshot(projectId, aggregateId);
    } catch (error) {
      this.logger.error(
        `Snapshot creation failed for aggregate ${aggregateId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}
