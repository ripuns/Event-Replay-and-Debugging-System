import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ProjectsRepository } from './projects.repository';

@Injectable()
export class ProjectsService {
  constructor(private readonly projectsRepository: ProjectsRepository) {}

  async create(organizationId: string, name: string) {
    return this.projectsRepository.create(organizationId, name);
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
}