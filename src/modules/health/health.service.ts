import {
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../cache/redis-cache.service';

export interface DependencyCheck {
  name: string;
  status: 'ok' | 'error';
  error?: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  getHealth() {
    return {
      status: 'ok',
      service: 'replaydb-api',
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness() {
    const [database, cache] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const checks = [database, cache];
    const allHealthy = checks.every((check) => check.status === 'ok');

    const result = {
      status: allHealthy ? ('ready' as const) : ('not_ready' as const),
      service: 'replaydb-api',
      timestamp: new Date().toISOString(),
      checks,
    };

    if (!allHealthy) {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }

  private async checkDatabase(): Promise<DependencyCheck> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { name: 'database', status: 'ok' };
    } catch (error) {
      return {
        name: 'database',
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async checkRedis(): Promise<DependencyCheck> {
    try {
      await this.redis.ping();
      return { name: 'redis', status: 'ok' };
    } catch (error) {
      return {
        name: 'redis',
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
