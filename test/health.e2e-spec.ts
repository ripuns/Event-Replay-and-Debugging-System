import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';

describe('Health API (e2e)', () => {
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

  it('GET /v1/health returns service health', () => {
    return request(app.getHttpServer())
      .get('/v1/health')
      .expect(200)
      .expect(({ body }) => {
        const health = body as {
          status: string;
          service: string;
          timestamp: string;
        };

        expect(health).toEqual(
          expect.objectContaining({
            status: 'ok',
            service: 'replaydb-api',
          }),
        );
        expect(health.timestamp).toEqual(expect.any(String));
      });
  });
});
