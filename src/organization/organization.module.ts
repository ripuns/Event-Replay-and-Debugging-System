import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationRepository } from './organization.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { ApiKeyModule } from '../api-keys/api-keys.module';
import { ProjectsModule } from '../projects/projects.module';
import { OrganizationController } from './organization.controller';
import { ApiKeyGuard } from '../common/auth/api-key.guard';

@Module({
  imports: [PrismaModule, ApiKeyModule, ProjectsModule],
  controllers: [OrganizationController],
  providers: [OrganizationService, OrganizationRepository, ApiKeyGuard],
  exports: [OrganizationService],
})
export class OrganizationModule {}
