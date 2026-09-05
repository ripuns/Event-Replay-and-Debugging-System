import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Aggregates API (e2e)', () => {
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
    await app.close();
  });

  async function bootstrapProject() {
    const res = await request(app.getHttpServer())
      .post('/v1/organizations')
      .send({
        name: `Aggregates Org ${Date.now()}`,
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

  async function registerReducer(
    projectId: string,
    rawKey: string,
    dto: {
      aggregateType: string;
      eventType: string;
      operation: string;
      field?: string;
    },
  ) {
    await request(app.getHttpServer())
      .post(`/v1/projects/${projectId}/event-reducers`)
      .set('Authorization', `Bearer ${rawKey}`)
      .send(dto)
      .expect(201);
  }

  async function appendEvent(
    projectId: string,
    rawKey: string,
    dto: {
      aggregateType: string;
      aggregateKey: string;
      eventType: string;
      eventVersion: number;
      payload: Record<string, unknown>;
    },
  ) {
    const res = await request(app.getHttpServer())
      .post(`/v1/projects/${projectId}/events`)
      .set('Authorization', `Bearer ${rawKey}`)
      .send(dto)
      .expect(201);

    return res.body as { aggregateId: string; sequenceNumber: string };
  }

  it('reconstructs aggregate state from set/merge/append reducer rules, and ignores unmapped event types', async () => {
    const { projectId, rawKey } = await bootstrapProject();

    await registerReducer(projectId, rawKey, {
      aggregateType: 'order',
      eventType: 'OrderPlaced',
      operation: 'set',
    });
    await registerReducer(projectId, rawKey, {
      aggregateType: 'order',
      eventType: 'ItemAdded',
      operation: 'append',
      field: 'items',
    });
    await registerReducer(projectId, rawKey, {
      aggregateType: 'order',
      eventType: 'OrderShipped',
      operation: 'merge',
      field: 'shipping',
    });

    await appendEvent(projectId, rawKey, {
      aggregateType: 'order',
      aggregateKey: 'ord_1',
      eventType: 'OrderPlaced',
      eventVersion: 1,
      payload: { total: 100, status: 'placed' },
    });
    await appendEvent(projectId, rawKey, {
      aggregateType: 'order',
      aggregateKey: 'ord_1',
      eventType: 'ItemAdded',
      eventVersion: 1,
      payload: { sku: 'A1' },
    });
    await appendEvent(projectId, rawKey, {
      aggregateType: 'order',
      aggregateKey: 'ord_1',
      eventType: 'ItemAdded',
      eventVersion: 1,
      payload: { sku: 'B2' },
    });
    const shipped = await appendEvent(projectId, rawKey, {
      aggregateType: 'order',
      aggregateKey: 'ord_1',
      eventType: 'OrderShipped',
      eventVersion: 1,
      payload: { carrier: 'UPS' },
    });
    await appendEvent(projectId, rawKey, {
      aggregateType: 'order',
      aggregateKey: 'ord_1',
      eventType: 'UnmappedEvent',
      eventVersion: 1,
      payload: { whatever: true },
    });

    const res = await request(app.getHttpServer())
      .get(`/v1/projects/${projectId}/aggregates/${shipped.aggregateId}/state`)
      .set('Authorization', `Bearer ${rawKey}`)
      .expect(200);

    expect(res.body).toEqual({
      aggregateId: shipped.aggregateId,
      aggregateType: 'order',
      aggregateKey: 'ord_1',
      asOfSequence: '5',
      state: {
        total: 100,
        status: 'placed',
        items: [{ sku: 'A1' }, { sku: 'B2' }],
        shipping: { carrier: 'UPS' },
      },
    });
  });

  it('supports point-in-time reconstruction via asOfSequence', async () => {
    const { projectId, rawKey } = await bootstrapProject();

    await registerReducer(projectId, rawKey, {
      aggregateType: 'order',
      eventType: 'OrderPlaced',
      operation: 'set',
    });
    await registerReducer(projectId, rawKey, {
      aggregateType: 'order',
      eventType: 'OrderShipped',
      operation: 'merge',
      field: 'shipping',
    });

    const placed = await appendEvent(projectId, rawKey, {
      aggregateType: 'order',
      aggregateKey: 'ord_2',
      eventType: 'OrderPlaced',
      eventVersion: 1,
      payload: { total: 50 },
    });
    await appendEvent(projectId, rawKey, {
      aggregateType: 'order',
      aggregateKey: 'ord_2',
      eventType: 'OrderShipped',
      eventVersion: 1,
      payload: { carrier: 'FedEx' },
    });

    const asOfFirst = await request(app.getHttpServer())
      .get(
        `/v1/projects/${projectId}/aggregates/${placed.aggregateId}/state?asOfSequence=${placed.sequenceNumber}`,
      )
      .set('Authorization', `Bearer ${rawKey}`)
      .expect(200);

    expect(asOfFirst.body).toMatchObject({
      asOfSequence: '1',
      state: { total: 50 },
    });
    expect(
      (asOfFirst.body as { state: Record<string, unknown> }).state.shipping,
    ).toBeUndefined();
  });

  it('rejects a malformed asOfSequence with 400', async () => {
    const { projectId, rawKey } = await bootstrapProject();
    const placed = await appendEvent(projectId, rawKey, {
      aggregateType: 'order',
      aggregateKey: 'ord_3',
      eventType: 'OrderPlaced',
      eventVersion: 1,
      payload: {},
    });

    await request(app.getHttpServer())
      .get(
        `/v1/projects/${projectId}/aggregates/${placed.aggregateId}/state?asOfSequence=not-a-number`,
      )
      .set('Authorization', `Bearer ${rawKey}`)
      .expect(400);
  });

  it('rejects reconstructing an aggregate with a key from a different project', async () => {
    const { projectId, rawKey } = await bootstrapProject();
    const { rawKey: otherKey } = await bootstrapProject();

    const placed = await appendEvent(projectId, rawKey, {
      aggregateType: 'order',
      aggregateKey: 'ord_4',
      eventType: 'OrderPlaced',
      eventVersion: 1,
      payload: {},
    });

    await request(app.getHttpServer())
      .get(`/v1/projects/${projectId}/aggregates/${placed.aggregateId}/state`)
      .set('Authorization', `Bearer ${otherKey}`)
      .expect(403);
  });
});
