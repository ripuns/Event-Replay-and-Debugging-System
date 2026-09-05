import { Injectable } from '@nestjs/common';
import { EventsRepository } from './events.repository';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';

export interface AppendEventInput {
  aggregateType: string;
  aggregateKey: string;
  eventType: string;
  eventVersion: number;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  occurredAt?: string;
}

@Injectable()
export class EventsService {
  constructor(
    private readonly eventsRepository: EventsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async append(projectId: string, input: AppendEventInput) {
    const event = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const aggregate =
          await this.eventsRepository.findOrCreateAggregateForUpdate(
            tx,
            projectId,
            input.aggregateType,
            input.aggregateKey,
          );

        const sequenceNumber = await this.eventsRepository.nextSequenceNumber(
          tx,
          aggregate.id,
        );

        return this.eventsRepository.createEvent(tx, {
          projectId,
          aggregateId: aggregate.id,
          sequenceNumber,
          eventType: input.eventType,
          eventVersion: input.eventVersion,
          payload: input.payload as Prisma.InputJsonValue,
          metadata: input.metadata as Prisma.InputJsonValue | undefined,
          occurredAt: input.occurredAt
            ? new Date(input.occurredAt)
            : new Date(),
        });
      },
    );

    return { ...event, sequenceNumber: event.sequenceNumber.toString() };
  }
}
