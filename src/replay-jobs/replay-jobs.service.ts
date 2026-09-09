import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ReplayJobsRepository } from './replay-jobs.repository';
import { REPLAY_JOBS_QUEUE } from '../queues/queue-names';
import type { ReplayJobData } from './replay-job.processor';

@Injectable()
export class ReplayJobsService {
  constructor(
    private readonly replayJobsRepository: ReplayJobsRepository,
    @InjectQueue(REPLAY_JOBS_QUEUE)
    private readonly replayJobsQueue: Queue<ReplayJobData>,
  ) {}

  async create(projectId: string, aggregateType?: string) {
    const job = await this.replayJobsRepository.create(
      projectId,
      aggregateType,
    );
    await this.replayJobsQueue.add('run-replay-job', { jobId: job.id });
    return job;
  }

  async findOne(jobId: string, projectId: string) {
    const job = await this.replayJobsRepository.findForProject(
      jobId,
      projectId,
    );
    if (!job) {
      throw new NotFoundException('Replay job not found');
    }
    return job;
  }
}
