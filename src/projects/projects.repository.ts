import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';

@Injectable()
export class ProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(
    organizationId: string,
    name: string,
    client: PrismaService | Prisma.TransactionClient = this.prisma,
  ) {
    return client.project.create({
      data: {
        organizationId,
        name,
      },
    });
  }

  findForOrganization(projectId: string, organizationId: string) {
    return this.prisma.project.findFirst({
      where: {
        id: projectId,
        organizationId,
      },
    });
  }

  findById(projectId: string) {
    return this.prisma.project.findUnique({
      where: { id: projectId },
    });
  }
}