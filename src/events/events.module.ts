import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventsRepository } from './events.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { ApiKeyModule } from '../api-keys/api-keys.module';
import { SnapshotsModule } from '../snapshots/snapshots.module';
import { CacheModule } from '../cache/cache.module';
import { ApiKeyGuard } from '../common/auth/api-key.guard';
import { ProjectAccessGuard } from '../common/auth/project-access.guard';

@Module({
  imports: [PrismaModule, ApiKeyModule, SnapshotsModule, CacheModule],
  controllers: [EventsController],
  providers: [EventsService, EventsRepository, ApiKeyGuard, ProjectAccessGuard],
  exports: [EventsService],
})
export class EventsModule {}
