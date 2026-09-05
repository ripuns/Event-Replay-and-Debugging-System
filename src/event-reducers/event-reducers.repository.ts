import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EventReducersRepository {
  constructor(private readonly prisma: PrismaService) {}

  upsert(
    projectId: string,
    aggregateType: string,
    eventType: string,
    operation: string,
    field?: string,
  ) {
    return this.prisma.eventReducer.upsert({
      where: {
        projectId_aggregateType_eventType: {
          projectId,
          aggregateType,
          eventType,
        },
      },
      create: { projectId, aggregateType, eventType, operation, field },
      update: { operation, field },
    });
  }

  findAllForProject(projectId: string) {
    return this.prisma.eventReducer.findMany({ where: { projectId } });
  }

  findAllForAggregateType(projectId: string, aggregateType: string) {
    return this.prisma.eventReducer.findMany({
      where: { projectId, aggregateType },
    });
  }
}
