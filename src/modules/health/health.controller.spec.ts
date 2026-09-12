import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../../cache/redis-cache.service';

describe('HealthController', () => {
  let controller: HealthController;
  let healthService: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        { provide: PrismaService, useValue: { $queryRaw: jest.fn() } },
        { provide: REDIS_CLIENT, useValue: { ping: jest.fn() } },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    healthService = module.get<HealthService>(HealthService);
  });

  it('returns an ok health status', () => {
    expect(controller.getHealth()).toMatchObject({
      status: 'ok',
      service: 'replaydb-api',
    });
  });

  it('delegates readiness checks to HealthService', () => {
    const getReadinessSpy = jest
      .spyOn(healthService, 'getReadiness')
      .mockResolvedValue({
        status: 'ready',
        service: 'replaydb-api',
        timestamp: new Date().toISOString(),
        checks: [
          { name: 'database', status: 'ok' },
          { name: 'redis', status: 'ok' },
        ],
      });

    void controller.getReadiness();

    expect(getReadinessSpy).toHaveBeenCalled();
  });
});
