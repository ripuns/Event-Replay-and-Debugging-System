import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import Redis from 'ioredis';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { aggregateStateCacheKey } from '../src/cache/cache-keys';

describe('Aggregate state cache (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let redis: Redis;
  const organizationIds: string[] = [];

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    redis = new Redis(process.env.REDIS_URL!);
  });

  afterEach(async () => {
    if (organizationIds.length > 0) {
      await prisma.event.deleteMany({
        where: { project: { organizationId: { in: organizationIds } } },
      });
      await prisma.eventReducer.deleteMany({
        where: { project: { organizationId: { in: organizationIds } } },
      });
      await prisma.aggregate.deleteMany({
        where: { project: { organizationId: { in: organizationIds } } },
      });
      await prisma.apiKey.deleteMany({
        where: { project: { organizationId: { in: organizationIds } } },
      });
      await prisma.project.deleteMany({
        where: { organizationId: { in: organizationIds } },
      });
      await prisma.organization.deleteMany({
        where: { id: { in: organizationIds } },
      });
      organizationIds.length = 0;
    }
    await redis.quit();
    await app.close();
  });

  async function bootstrapProject() {
    const res = await request(app.getHttpServer())
      .post('/v1/organizations')
      .send({
        name: `Cache Org ${Date.now()}`,
        firstProject: { name: 'Orders' },
      })
      .expect(201);

    const body = res.body as {
      organization: { id: string };
      project: { id: string };
      apiKey: { rawKey: string };
    };
    organizationIds.push(body.organization.id);
    return { projectId: body.project.id, rawKey: body.apiKey.rawKey };
  }

  async function registerReducer(projectId: string, rawKey: string) {
    await request(app.getHttpServer())
      .post(`/v1/projects/${projectId}/event-reducers`)
      .set('Authorization', `Bearer ${rawKey}`)
      .send({ aggregateType: 'order', eventType: 'Tick', operation: 'set' })
      .expect(201);
  }

  async function appendTick(
    projectId: string,
    rawKey: string,
    aggregateKey: string,
    n: number,
  ) {
    const res = await request(app.getHttpServer())
      .post(`/v1/projects/${projectId}/events`)
      .set('Authorization', `Bearer ${rawKey}`)
      .send({
        aggregateType: 'order',
        aggregateKey,
        eventType: 'Tick',
        eventVersion: 1,
        payload: { n },
      })
      .expect(201);

    return res.body as { aggregateId: string; sequenceNumber: string };
  }

  async function getState(
    projectId: string,
    rawKey: string,
    aggregateId: string,
    asOfSequence?: string,
  ) {
    const query = asOfSequence ? `?asOfSequence=${asOfSequence}` : '';
    const res = await request(app.getHttpServer())
      .get(`/v1/projects/${projectId}/aggregates/${aggregateId}/state${query}`)
      .set('Authorization', `Bearer ${rawKey}`)
      .expect(200);
    return res.body as { state: { n: number } };
  }

  it('populates the state cache on a miss and serves the same value on a hit', async () => {
    const { projectId, rawKey } = await bootstrapProject();
    await registerReducer(projectId, rawKey);
    const event = await appendTick(projectId, rawKey, 'ord_1', 1);

    const cacheKey = aggregateStateCacheKey(event.aggregateId);
    expect(await redis.get(cacheKey)).toBeNull();

    const first = await getState(projectId, rawKey, event.aggregateId);
    expect(first.state).toEqual({ n: 1 });

    const cachedRaw = await redis.get(cacheKey);
    expect(cachedRaw).not.toBeNull();
    expect((JSON.parse(cachedRaw!) as { state: { n: number } }).state).toEqual({
      n: 1,
    });

    const second = await getState(projectId, rawKey, event.aggregateId);
    expect(second.state).toEqual({ n: 1 });
  });

  it('invalidates the latest cache entry on a new append, never returning stale state', async () => {
    const { projectId, rawKey } = await bootstrapProject();
    await registerReducer(projectId, rawKey);
    const first = await appendTick(projectId, rawKey, 'ord_2', 1);

    await getState(projectId, rawKey, first.aggregateId);
    expect(
      await redis.get(aggregateStateCacheKey(first.aggregateId)),
    ).not.toBeNull();

    await appendTick(projectId, rawKey, 'ord_2', 2);
    expect(
      await redis.get(aggregateStateCacheKey(first.aggregateId)),
    ).toBeNull();

    const state = await getState(projectId, rawKey, first.aggregateId);
    expect(state.state).toEqual({ n: 2 });
  });

  it('caches a historical asOfSequence entry independently, surviving later invalidations of "latest"', async () => {
    const { projectId, rawKey } = await bootstrapProject();
    await registerReducer(projectId, rawKey);
    const first = await appendTick(projectId, rawKey, 'ord_3', 1);

    await getState(projectId, rawKey, first.aggregateId, first.sequenceNumber);
    const historicalKey = aggregateStateCacheKey(
      first.aggregateId,
      first.sequenceNumber,
    );
    expect(await redis.get(historicalKey)).not.toBeNull();

    await appendTick(projectId, rawKey, 'ord_3', 2);

    // "latest" was invalidated by the new append, but the historical entry
    // for sequence 1 must survive - that point in history can never change.
    expect(await redis.get(historicalKey)).not.toBeNull();

    const historicalState = await getState(
      projectId,
      rawKey,
      first.aggregateId,
      first.sequenceNumber,
    );
    expect(historicalState.state).toEqual({ n: 1 });
  });
});
