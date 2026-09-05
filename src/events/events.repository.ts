import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';

@Injectable()
export class EventsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Finds or creates the aggregate for (projectId, aggregateType, aggregateKey),
   * then locks its row (SELECT ... FOR UPDATE) so concurrent appends to the same
   * aggregate serialize instead of racing on sequence_number assignment.
   * Must run inside a transaction.
   *
   * Uses raw INSERT ... ON CONFLICT DO NOTHING rather than Prisma's upsert()
   * because upsert's create/update are two separate statements under
   * READ COMMITTED isolation: two concurrent transactions can both see "no row
   * exists" and both attempt the create, so the loser hits the unique
   * constraint instead of falling back to update. ON CONFLICT DO NOTHING lets
   * Postgres resolve the race atomically in a single statement.
   */
  async findOrCreateAggregateForUpdate(
    tx: Prisma.TransactionClient,
    projectId: string,
    aggregateType: string,
    aggregateKey: string,
  ) {
    await tx.$executeRaw`
      INSERT INTO aggregates (project_id, aggregate_type, aggregate_key)
      VALUES (${projectId}::uuid, ${aggregateType}, ${aggregateKey})
      ON CONFLICT (project_id, aggregate_type, aggregate_key) DO NOTHING
    `;

    const [aggregate] = await tx.$queryRaw<
      { id: string; project_id: string }[]
    >`
      SELECT id, project_id FROM aggregates
      WHERE project_id = ${projectId}::uuid
        AND aggregate_type = ${aggregateType}
        AND aggregate_key = ${aggregateKey}
      FOR UPDATE
    `;

    return aggregate;
  }

  async nextSequenceNumber(
    tx: Prisma.TransactionClient,
    aggregateId: string,
  ): Promise<bigint> {
    const last = await tx.event.findFirst({
      where: { aggregateId },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    });

    return (last?.sequenceNumber ?? BigInt(0)) + BigInt(1);
  }

  createEvent(
    tx: Prisma.TransactionClient,
    data: {
      projectId: string;
      aggregateId: string;
      sequenceNumber: bigint;
      eventType: string;
      eventVersion: number;
      payload: Prisma.InputJsonValue;
      metadata?: Prisma.InputJsonValue;
      occurredAt: Date;
    },
  ) {
    return tx.event.create({ data });
  }

  findById(eventId: string) {
    return this.prisma.event.findUnique({ where: { id: eventId } });
  }
}
