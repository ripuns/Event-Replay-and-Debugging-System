import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EventReducersService } from './event-reducers.service';
import { CreateEventReducerDto } from './dto/create-event-reducer.dto';
import { ApiKeyGuard } from '../common/auth/api-key.guard';
import { ProjectAccessGuard } from '../common/auth/project-access.guard';

@ApiTags('event-reducers')
@ApiBearerAuth('api-key')
@Controller()
export class EventReducersController {
  constructor(private readonly eventReducersService: EventReducersService) {}

  @Post('projects/:id/event-reducers')
  @ApiOperation({
    summary:
      'Declare (or replace) how a given aggregateType+eventType folds into aggregate state',
  })
  @UseGuards(ApiKeyGuard, ProjectAccessGuard)
  upsert(@Param('id') projectId: string, @Body() dto: CreateEventReducerDto) {
    return this.eventReducersService.upsert(projectId, dto);
  }

  @Get('projects/:id/event-reducers')
  @ApiOperation({ summary: 'List all reducer rules declared for a project' })
  @UseGuards(ApiKeyGuard, ProjectAccessGuard)
  findAll(@Param('id') projectId: string) {
    return this.eventReducersService.findAllForProject(projectId);
  }
}
