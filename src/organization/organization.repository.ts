import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(name: string) {
    return this.prisma.organization.create({
      data: { name },
    });
  }

  findById(id: string) {
    return this.prisma.organization.findUnique({
      where: { id },
    });
  }
}