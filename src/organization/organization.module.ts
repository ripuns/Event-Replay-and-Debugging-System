import { Module } from '@nestjs/common';
import { OrganizationService } from './organization.service';
import { OrganizationRepository } from './organization.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    OrganizationService,
    OrganizationRepository,
  ],
  exports: [OrganizationService],
})
export class OrganizationModule {}