import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';

@Injectable()
export class ReplayJobsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(projectId: string, aggregateType?: string) {
    return this.prisma.replayJob.create({
      data: { projectId, aggregateType, status: 'pending' },
    });
  }

  findForProject(jobId: string, projectId: string) {
    return this.prisma.replayJob.findFirst({
      where: { id: jobId, projectId },
    });
  }

  markRunning(jobId: string) {
    return this.prisma.replayJob.update({
      where: { id: jobId },
      data: { status: 'running', startedAt: new Date() },
    });
  }

  markCompleted(jobId: string, result: Prisma.InputJsonValue) {
    return this.prisma.replayJob.update({
      where: { id: jobId },
      data: { status: 'completed', completedAt: new Date(), result },
    });
  }

  markFailed(jobId: string, error: string) {
    return this.prisma.replayJob.update({
      where: { id: jobId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        error: error.slice(0, 255),
      },
    });
  }

  findAggregateIdsForScope(projectId: string, aggregateType?: string) {
    return this.prisma.aggregate.findMany({
      where: { projectId, ...(aggregateType ? { aggregateType } : {}) },
      select: { id: true },
    });
  }
}
