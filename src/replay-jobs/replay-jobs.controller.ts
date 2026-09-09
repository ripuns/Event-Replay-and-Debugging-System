import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ReplayJobsService } from './replay-jobs.service';
import { CreateReplayJobDto } from './dto/create-replay-job.dto';
import { ApiKeyGuard } from '../common/auth/api-key.guard';
import { ProjectAccessGuard } from '../common/auth/project-access.guard';

@ApiTags('replay-jobs')
@ApiBearerAuth('api-key')
@Controller()
export class ReplayJobsController {
  constructor(private readonly replayJobsService: ReplayJobsService) {}

  @Post('projects/:id/replay-jobs')
  @ApiOperation({
    summary:
      'Start an async replay job that recomputes and snapshots state for every matching aggregate in a project',
  })
  @UseGuards(ApiKeyGuard, ProjectAccessGuard)
  create(@Param('id') projectId: string, @Body() dto: CreateReplayJobDto) {
    return this.replayJobsService.create(projectId, dto.aggregateType);
  }

  @Get('projects/:id/replay-jobs/:jobId')
  @ApiOperation({ summary: "Get a replay job's status and result" })
  @UseGuards(ApiKeyGuard, ProjectAccessGuard)
  findOne(@Param('id') projectId: string, @Param('jobId') jobId: string) {
    return this.replayJobsService.findOne(jobId, projectId);
  }
}
