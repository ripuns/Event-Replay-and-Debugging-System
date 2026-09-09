import { Module } from '@nestjs/common';
import { AggregatesController } from './aggregates.controller';
import { AggregatesService } from './aggregates.service';
import { AggregatesRepository } from './aggregates.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { ApiKeyModule } from '../api-keys/api-keys.module';
import { EventReducersModule } from '../event-reducers/event-reducers.module';
import { SnapshotsRepository } from '../snapshots/snapshots.repository';
import { ApiKeyGuard } from '../common/auth/api-key.guard';
import { ProjectAccessGuard } from '../common/auth/project-access.guard';

@Module({
  imports: [PrismaModule, ApiKeyModule, EventReducersModule],
  controllers: [AggregatesController],
  providers: [
    AggregatesService,
    AggregatesRepository,
    SnapshotsRepository,
    ApiKeyGuard,
    ProjectAccessGuard,
  ],
  exports: [AggregatesService],
})
export class AggregatesModule {}
