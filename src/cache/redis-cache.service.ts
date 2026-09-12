import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

export const REDIS_CLIENT = 'REDIS_CLIENT';

/*
  Thin wrapper around a raw ioredis client for application-level caching
  (as opposed to BullMQ's own Redis connections in src/queues). Every method
  fails open: a Redis error is logged and treated as a cache miss / no-op
  rather than propagated, since the cache is a pure optimization - Postgres
  remains the source of truth (refer src/snapshots/README.md).
 */
@Injectable()
export class RedisCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheService.name);

  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await this.redis.get(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch (error) {
      this.logger.warn(
        `Cache get failed for key "${key}"`,
        error instanceof Error ? error.message : String(error),
      );
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds !== undefined) {
        await this.redis.set(key, serialized, 'EX', ttlSeconds);
      } else {
        await this.redis.set(key, serialized);
      }
    } catch (error) {
      this.logger.warn(
        `Cache set failed for key "${key}"`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.redis.del(...keys);
    } catch (error) {
      this.logger.warn(
        `Cache del failed for keys [${keys.join(', ')}]`,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
