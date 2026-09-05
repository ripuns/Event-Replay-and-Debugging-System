import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Events API (e2e)', () => {
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
        name: `Events Org ${Date.now()}`,
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

  it('auto-creates the aggregate on first event and assigns sequence number 1', async () => {
    const { projectId, rawKey } = await bootstrapProject();

    const res = await request(app.getHttpServer())
      .post(`/v1/projects/${projectId}/events`)
      .set('Authorization', `Bearer ${rawKey}`)
      .send({
        aggregateType: 'order',
        aggregateKey: 'ord_1',
        eventType: 'OrderPlaced',
        eventVersion: 1,
        payload: { total: 100 },
      })
      .expect(201);

    const body = res.body as {
      sequenceNumber: string;
      payload: { total: number };
    };
    expect(body.sequenceNumber).toBe('1');
    expect(body.payload).toEqual({ total: 100 });
  });

  it('assigns increasing sequence numbers per aggregate, independent across aggregates', async () => {
    const { projectId, rawKey } = await bootstrapProject();

    const appendTo = (aggregateKey: string, eventType: string) =>
      request(app.getHttpServer())
        .post(`/v1/projects/${projectId}/events`)
        .set('Authorization', `Bearer ${rawKey}`)
        .send({
          aggregateType: 'order',
          aggregateKey,
          eventType,
          eventVersion: 1,
          payload: {},
        })
        .expect(201);

    const first = await appendTo('ord_a', 'OrderPlaced');
    const second = await appendTo('ord_a', 'OrderShipped');
    const otherAggregate = await appendTo('ord_b', 'OrderPlaced');

    expect((first.body as { sequenceNumber: string }).sequenceNumber).toBe('1');
    expect((second.body as { sequenceNumber: string }).sequenceNumber).toBe(
      '2',
    );
    expect(
      (otherAggregate.body as { sequenceNumber: string }).sequenceNumber,
    ).toBe('1');
  });

  it('assigns unique, gapless sequence numbers under concurrent appends to the same new aggregate', async () => {
    const { projectId, rawKey } = await bootstrapProject();

    const CONCURRENCY = 15;
    const responses = await Promise.all(
      Array.from({ length: CONCURRENCY }, (_, i) =>
        request(app.getHttpServer())
          .post(`/v1/projects/${projectId}/events`)
          .set('Authorization', `Bearer ${rawKey}`)
          .send({
            aggregateType: 'order',
            aggregateKey: 'ord_race',
            eventType: 'Tick',
            eventVersion: 1,
            payload: { n: i },
          }),
      ),
    );

    for (const res of responses) {
      expect(res.status).toBe(201);
    }

    const sequenceNumbers = responses
      .map((res) =>
        Number((res.body as { sequenceNumber: string }).sequenceNumber),
      )
      .sort((a, b) => a - b);

    expect(sequenceNumbers).toEqual(
      Array.from({ length: CONCURRENCY }, (_, i) => i + 1),
    );
  });

  it('rejects appending an event without a valid API key', async () => {
    const { projectId } = await bootstrapProject();

    await request(app.getHttpServer())
      .post(`/v1/projects/${projectId}/events`)
      .send({
        aggregateType: 'order',
        aggregateKey: 'ord_1',
        eventType: 'OrderPlaced',
        eventVersion: 1,
        payload: {},
      })
      .expect(401);
  });
});
