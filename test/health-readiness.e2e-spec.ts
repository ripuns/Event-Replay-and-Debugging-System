import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Health readiness (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('reports ready with passing database and redis checks when both are reachable', async () => {
    const res = await request(app.getHttpServer())
      .get('/v1/health/ready')
      .expect(200);

    const body = res.body as {
      status: string;
      checks: { name: string; status: string }[];
    };

    expect(body.status).toBe('ready');
    expect(body.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'database', status: 'ok' }),
        expect.objectContaining({ name: 'redis', status: 'ok' }),
      ]),
    );
  });

  // The not-ready/503 path (a dependency genuinely unreachable) is covered by:
  // - src/modules/health/health.controller.spec.ts's unit test, which mocks
  //   PrismaService/REDIS_CLIENT to force a failing check without needing
  //   real infra to actually go down.
  // - manual verification against a live stack: stopping the docker-compose
  //   redis container and confirming a real 503 with
  //   { status: 'not_ready', checks: [{ name: 'redis', status: 'error', error: '...' }] },
  //   then confirming recovery once redis was restarted (see
  //   src/modules/health/README.md).
  // A synthetic e2e version (swapping in a second ioredis client pointed at
  // an unreachable port via a DI override) was attempted here but caused
  // Jest to hang indefinitely on module teardown - ioredis's own
  // retry/reconnect bookkeeping for the broken client didn't unwind cleanly
  // when overridden into the same app's DI graph. Not worth chasing further
  // given the failure path is already proven both ways above.
});
