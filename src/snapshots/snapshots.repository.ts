import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';

@Injectable()
export class SnapshotsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findLatestUpTo(aggregateId: string, asOfSequence?: bigint) {
    return this.prisma.snapshot.findFirst({
      where: {
        aggregateId,
        ...(asOfSequence !== undefined
          ? { sequenceNumber: { lte: asOfSequence } }
          : {}),
      },
      orderBy: { sequenceNumber: 'desc' },
    });
  }

  findLatest(aggregateId: string) {
    return this.prisma.snapshot.findFirst({
      where: { aggregateId },
      orderBy: { sequenceNumber: 'desc' },
    });
  }

  create(data: {
    aggregateId: string;
    projectId: string;
    sequenceNumber: bigint;
    state: Prisma.InputJsonValue;
  }) {
    return this.prisma.snapshot.create({ data });
  }

  countEventsSince(aggregateId: string, afterSequence?: bigint) {
    return this.prisma.event.count({
      where: {
        aggregateId,
        ...(afterSequence !== undefined
          ? { sequenceNumber: { gt: afterSequence } }
          : {}),
      },
    });
  }
}
