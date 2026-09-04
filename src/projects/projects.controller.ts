import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { ApiKeyService } from '../api-keys/api-keys.service';
import { CreateApiKeyDto } from '../api-keys/dto/create-api-key.dto';
import { ApiKeyGuard } from '../common/auth/api-key.guard';
import { ProjectAccessGuard } from '../common/auth/project-access.guard';
import { OrganizationAccessGuard } from '../common/auth/organization-access.guard';

@ApiTags('projects')
@ApiBearerAuth('api-key')
@Controller()
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  @Post('organizations/:orgId/projects')
  @ApiOperation({
    summary:
      'Create an additional project in an organization, minting its first API key',
  })
  @UseGuards(ApiKeyGuard, OrganizationAccessGuard)
  create(@Param('orgId') orgId: string, @Body() dto: CreateProjectDto) {
    return this.projectsService.createWithFirstKey(orgId, dto.name);
  }

  @Post('projects/:id/api-keys')
  @ApiOperation({ summary: 'Mint an additional API key for a project' })
  @UseGuards(ApiKeyGuard, ProjectAccessGuard)
  createApiKey(@Param('id') projectId: string, @Body() dto: CreateApiKeyDto) {
    return this.apiKeyService.create(projectId, dto.name);
  }

  @Get('projects/:id')
  @ApiOperation({ summary: 'Get a project by id' })
  @UseGuards(ApiKeyGuard, ProjectAccessGuard)
  async findOne(@Param('id') id: string) {
    const project = await this.projectsService.findById(id);
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }
}
