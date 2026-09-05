import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { EventsService } from './events.service';
import { AppendEventDto } from './dto/append-event.dto';
import { ApiKeyGuard } from '../common/auth/api-key.guard';
import { ProjectAccessGuard } from '../common/auth/project-access.guard';

@ApiTags('events')
@ApiBearerAuth('api-key')
@Controller()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Post('projects/:id/events')
  @ApiOperation({
    summary:
      'Append an event to an aggregate, auto-creating the aggregate if it does not exist yet',
  })
  @UseGuards(ApiKeyGuard, ProjectAccessGuard)
  append(@Param('id') projectId: string, @Body() dto: AppendEventDto) {
    return this.eventsService.append(projectId, dto);
  }
}
