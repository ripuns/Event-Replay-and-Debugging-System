import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AggregatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findForProject(aggregateId: string, projectId: string) {
    return this.prisma.aggregate.findFirst({
      where: { id: aggregateId, projectId },
    });
  }

  findEventsInRange(
    aggregateId: string,
    afterSequence?: bigint,
    upToSequence?: bigint,
  ) {
    return this.prisma.event.findMany({
      where: {
        aggregateId,
        sequenceNumber: {
          ...(afterSequence !== undefined ? { gt: afterSequence } : {}),
          ...(upToSequence !== undefined ? { lte: upToSequence } : {}),
        },
      },
      orderBy: { sequenceNumber: 'asc' },
    });
  }
}
