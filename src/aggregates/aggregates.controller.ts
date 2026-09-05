import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AggregatesService } from './aggregates.service';
import { ApiKeyGuard } from '../common/auth/api-key.guard';
import { ProjectAccessGuard } from '../common/auth/project-access.guard';

@ApiTags('aggregates')
@ApiBearerAuth('api-key')
@Controller()
export class AggregatesController {
  constructor(private readonly aggregatesService: AggregatesService) {}

  @Get('projects/:id/aggregates/:aggregateId/state')
  @ApiOperation({
    summary:
      "Reconstruct an aggregate's state by replaying its events, optionally as of a specific sequence number",
  })
  @ApiQuery({
    name: 'asOfSequence',
    required: false,
    description:
      'Reconstruct state as of this sequence number (inclusive). Defaults to the latest event.',
  })
  @UseGuards(ApiKeyGuard, ProjectAccessGuard)
  getState(
    @Param('id') projectId: string,
    @Param('aggregateId') aggregateId: string,
    @Query('asOfSequence') asOfSequence?: string,
  ) {
    if (asOfSequence !== undefined && !/^\d+$/.test(asOfSequence)) {
      throw new BadRequestException('asOfSequence must be a positive integer');
    }

    return this.aggregatesService.getState(
      projectId,
      aggregateId,
      asOfSequence,
    );
  }
}
