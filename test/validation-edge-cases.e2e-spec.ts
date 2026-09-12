import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Validation edge cases (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
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
  });

  afterEach(async () => {
    if (organizationIds.length > 0) {
      await prisma.eventReducer.deleteMany({
        where: { project: { organizationId: { in: organizationIds } } },
      });
      await prisma.event.deleteMany({
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
    await app.close();
  });

  async function bootstrapProject() {
    const res = await request(app.getHttpServer())
      .post('/v1/organizations')
      .send({
        name: `Validation Edge Cases Org ${Date.now()}`,
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

  describe('POST /v1/projects/:id/events', () => {
    it('rejects a payload missing required fields', async () => {
      const { projectId, rawKey } = await bootstrapProject();

      await request(app.getHttpServer())
        .post(`/v1/projects/${projectId}/events`)
        .set('Authorization', `Bearer ${rawKey}`)
        .send({ aggregateType: 'order' })
        .expect(400);
    });

    it('rejects a non-integer or non-positive eventVersion', async () => {
      const { projectId, rawKey } = await bootstrapProject();

      const base = {
        aggregateType: 'order',
        aggregateKey: 'ord_v',
        eventType: 'OrderPlaced',
        payload: {},
      };

      await request(app.getHttpServer())
        .post(`/v1/projects/${projectId}/events`)
        .set('Authorization', `Bearer ${rawKey}`)
        .send({ ...base, eventVersion: 0 })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/v1/projects/${projectId}/events`)
        .set('Authorization', `Bearer ${rawKey}`)
        .send({ ...base, eventVersion: 1.5 })
        .expect(400);
    });

    it('rejects an invalid occurredAt date string', async () => {
      const { projectId, rawKey } = await bootstrapProject();

      await request(app.getHttpServer())
        .post(`/v1/projects/${projectId}/events`)
        .set('Authorization', `Bearer ${rawKey}`)
        .send({
          aggregateType: 'order',
          aggregateKey: 'ord_v',
          eventType: 'OrderPlaced',
          eventVersion: 1,
          payload: {},
          occurredAt: 'not-a-date',
        })
        .expect(400);
    });

    it('rejects unknown properties in the request body', async () => {
      const { projectId, rawKey } = await bootstrapProject();

      await request(app.getHttpServer())
        .post(`/v1/projects/${projectId}/events`)
        .set('Authorization', `Bearer ${rawKey}`)
        .send({
          aggregateType: 'order',
          aggregateKey: 'ord_v',
          eventType: 'OrderPlaced',
          eventVersion: 1,
          payload: {},
          unexpectedField: 'should be rejected',
        })
        .expect(400);
    });
  });

  describe('POST /v1/projects/:id/event-reducers', () => {
    it('rejects an invalid operation enum value', async () => {
      const { projectId, rawKey } = await bootstrapProject();

      await request(app.getHttpServer())
        .post(`/v1/projects/${projectId}/event-reducers`)
        .set('Authorization', `Bearer ${rawKey}`)
        .send({
          aggregateType: 'order',
          eventType: 'OrderShipped',
          operation: 'delete',
        })
        .expect(400);
    });

    it('rejects merge/append operations missing a field', async () => {
      const { projectId, rawKey } = await bootstrapProject();

      await request(app.getHttpServer())
        .post(`/v1/projects/${projectId}/event-reducers`)
        .set('Authorization', `Bearer ${rawKey}`)
        .send({
          aggregateType: 'order',
          eventType: 'OrderShipped',
          operation: 'merge',
        })
        .expect(400);

      await request(app.getHttpServer())
        .post(`/v1/projects/${projectId}/event-reducers`)
        .set('Authorization', `Bearer ${rawKey}`)
        .send({
          aggregateType: 'order',
          eventType: 'OrderNoteAdded',
          operation: 'append',
        })
        .expect(400);
    });

    it('accepts a set operation without a field', async () => {
      const { projectId, rawKey } = await bootstrapProject();

      await request(app.getHttpServer())
        .post(`/v1/projects/${projectId}/event-reducers`)
        .set('Authorization', `Bearer ${rawKey}`)
        .send({
          aggregateType: 'order',
          eventType: 'OrderCreated',
          operation: 'set',
        })
        .expect(201);
    });
  });

  describe('POST /v1/organizations', () => {
    it('rejects a missing organization name', async () => {
      await request(app.getHttpServer())
        .post('/v1/organizations')
        .send({})
        .expect(400);
    });

    it('rejects an over-length organization name', async () => {
      await request(app.getHttpServer())
        .post('/v1/organizations')
        .send({ name: 'a'.repeat(256) })
        .expect(400);
    });

    it('rejects a malformed nested firstProject', async () => {
      await request(app.getHttpServer())
        .post('/v1/organizations')
        .send({ name: 'Nested Validation Org', firstProject: { name: '' } })
        .expect(400);
    });
  });
});
