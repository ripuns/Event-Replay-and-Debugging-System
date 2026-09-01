import { Module } from '@nestjs/common';
import { ProjectsRepository } from './projects.repository';
import { ProjectsService } from './projects.service';
import { PrismaModule } from '../prisma/prisma.module';
import { ApiKeyModule } from '../api-keys/api-keys.module';
import { ProjectsController } from './projects.controller';
import { ApiKeyGuard } from '../common/auth/api-key.guard';
import { ProjectAccessGuard } from '../common/auth/project-access.guard';
import { OrganizationAccessGuard } from '../common/auth/organization-access.guard';

@Module({
  imports: [PrismaModule, ApiKeyModule],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectsRepository,
    ApiKeyGuard,
    ProjectAccessGuard,
    OrganizationAccessGuard,
  ],
  exports: [ProjectsService, ProjectsRepository],
})
export class ProjectsModule {}
