import { ForbiddenException, Injectable } from '@nestjs/common';
import { ProjectsRepository } from './projects.repository';
import { ApiKeyService, CreatedApiKey } from '../api-keys/api-keys.service';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';

export interface ProjectWithFirstKey {
  project: {
    id: string;
    organizationId: string;
    name: string;
    createdAt: Date;
  };
  apiKey: CreatedApiKey;
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly projectsRepository: ProjectsRepository,
    private readonly apiKeyService: ApiKeyService,
    private readonly prisma: PrismaService,
  ) {}

  async create(organizationId: string, name: string) {
    return this.projectsRepository.create(organizationId, name);
  }

  async createWithFirstKey(
    organizationId: string,
    name: string,
  ): Promise<ProjectWithFirstKey> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const project = await this.projectsRepository.create(
        organizationId,
        name,
        tx,
      );
      const apiKey = await this.apiKeyService.create(
        project.id,
        `${name} default key`,
        tx,
      );

      return { project, apiKey };
    });
  }

  async requireProject(projectId: string, organizationId: string) {
    const project = await this.projectsRepository.findForOrganization(
      projectId,
      organizationId,
    );

    if (!project) {
      throw new ForbiddenException('Project is not accessible');
    }

    return project;
  }

  async findById(projectId: string) {
    return this.projectsRepository.findById(projectId);
  }
}
