import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { Prisma } from '../generated/prisma/client';

@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(name: string, client: PrismaService | Prisma.TransactionClient = this.prisma) {
    return client.organization.create({
      data: { name },
    });
  }

  findById(id: string) {
    return this.prisma.organization.findUnique({
      where: { id },
    });
  }
}