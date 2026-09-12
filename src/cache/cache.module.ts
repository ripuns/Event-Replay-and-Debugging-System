import { Module } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisCacheService, REDIS_CLIENT } from './redis-cache.service';

@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: () => new Redis(process.env.REDIS_URL!),
    },
    RedisCacheService,
  ],
  exports: [RedisCacheService, REDIS_CLIENT],
})
export class CacheModule {}
