import { Module } from '@nestjs/common';
import { ApiKeyService } from './api-keys.service';
import { ApiKeyRepository } from './api-keys.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [
    ApiKeyService,
    ApiKeyRepository,
  ],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}