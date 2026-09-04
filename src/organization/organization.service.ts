import { Injectable } from '@nestjs/common';
import { OrganizationRepository } from './organization.repository';
import { ProjectsRepository } from '../projects/projects.repository';
import { ApiKeyService, CreatedApiKey } from '../api-keys/api-keys.service';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';

export interface OrganizationWithFirstProject {
  organization: { id: string; name: string; createdAt: Date };
  project?: {
    id: string;
    organizationId: string;
    name: string;
    createdAt: Date;
  };
  apiKey?: CreatedApiKey;
}

@Injectable()
export class OrganizationService {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly projectsRepository: ProjectsRepository,
    private readonly apiKeyService: ApiKeyService,
    private readonly prisma: PrismaService,
  ) {}

  async create(
    name: string,
    firstProject?: { name: string },
  ): Promise<OrganizationWithFirstProject> {
    if (!firstProject) {
      const organization = await this.organizationRepository.create(name);
      return { organization };
    }

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const organization = await this.organizationRepository.create(name, tx);
      const project = await this.projectsRepository.create(
        organization.id,
        firstProject.name,
        tx,
      );
      const apiKey = await this.apiKeyService.create(
        project.id,
        `${firstProject.name} default key`,
        tx,
      );

      return { organization, project, apiKey };
    });
  }

  async findById(id: string) {
    return this.organizationRepository.findById(id);
  }
}
