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

  findEventsUpTo(aggregateId: string, asOfSequence?: bigint) {
    return this.prisma.event.findMany({
      where: {
        aggregateId,
        ...(asOfSequence !== undefined
          ? { sequenceNumber: { lte: asOfSequence } }
          : {}),
      },
      orderBy: { sequenceNumber: 'asc' },
    });
  }
}
