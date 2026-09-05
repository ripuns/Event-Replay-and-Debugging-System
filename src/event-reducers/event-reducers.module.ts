import { Module } from '@nestjs/common';
import { EventReducersController } from './event-reducers.controller';
import { EventReducersService } from './event-reducers.service';
import { EventReducersRepository } from './event-reducers.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { ApiKeyModule } from '../api-keys/api-keys.module';
import { ApiKeyGuard } from '../common/auth/api-key.guard';
import { ProjectAccessGuard } from '../common/auth/project-access.guard';

@Module({
  imports: [PrismaModule, ApiKeyModule],
  controllers: [EventReducersController],
  providers: [
    EventReducersService,
    EventReducersRepository,
    ApiKeyGuard,
    ProjectAccessGuard,
  ],
  exports: [EventReducersService],
})
export class EventReducersModule {}
