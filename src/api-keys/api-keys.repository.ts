import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ApiKeyRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(projectId: string, name: string, keyHash: string, keyPrefix: string) {
    return this.prisma.apiKey.create({
      data: {projectId, name, keyHash, keyPrefix},
    });
  }

  findByHash(keyHash: string) {
    return this.prisma.apiKey.findUnique({
      where: { keyHash },
      include: { project: { select: { organizationId: true } } },
    });
  }
}
