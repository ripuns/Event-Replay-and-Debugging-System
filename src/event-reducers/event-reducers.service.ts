import { Injectable } from '@nestjs/common';
import { EventReducersRepository } from './event-reducers.repository';
import { CreateEventReducerDto } from './dto/create-event-reducer.dto';

@Injectable()
export class EventReducersService {
  constructor(
    private readonly eventReducersRepository: EventReducersRepository,
  ) {}

  upsert(projectId: string, dto: CreateEventReducerDto) {
    return this.eventReducersRepository.upsert(
      projectId,
      dto.aggregateType,
      dto.eventType,
      dto.operation,
      dto.field,
    );
  }

  findAllForProject(projectId: string) {
    return this.eventReducersRepository.findAllForProject(projectId);
  }

  findAllForAggregateType(projectId: string, aggregateType: string) {
    return this.eventReducersRepository.findAllForAggregateType(
      projectId,
      aggregateType,
    );
  }
}
