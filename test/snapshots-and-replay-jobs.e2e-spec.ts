import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Snapshots and Replay Jobs (e2e)', () => {
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
      await prisma.replayJob.deleteMany({
        where: { project: { organizationId: { in: organizationIds } } },
      });
      await prisma.snapshot.deleteMany({
        where: {
          aggregate: { project: { organizationId: { in: organizationIds } } },
        },
      });
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
        name: `Snapshots Org ${Date.now()}`,
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

  async function waitForSnapshot(aggregateId: string, timeoutMs = 10000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const snapshot = await prisma.snapshot.findFirst({
        where: { aggregateId },
        orderBy: { sequenceNumber: 'desc' },
      });
      if (snapshot) return snapshot;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(
      `No snapshot created for aggregate ${aggregateId} within ${timeoutMs}ms`,
    );
  }

  async function waitForJobCompletion(
    projectId: string,
    rawKey: string,
    jobId: string,
    timeoutMs = 10000,
  ) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const res = await request(app.getHttpServer())
        .get(`/v1/projects/${projectId}/replay-jobs/${jobId}`)
        .set('Authorization', `Bearer ${rawKey}`)
        .expect(200);

      const body = res.body as { status: string };
      if (body.status === 'completed' || body.status === 'failed') return body;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Replay job ${jobId} did not finish within ${timeoutMs}ms`);
  }

  it('automatically creates a snapshot once an aggregate crosses the event threshold, and getState uses it correctly', async () => {
    const { projectId, rawKey } = await bootstrapProject();
    await registerReducer(projectId, rawKey);

    let lastEvent: { aggregateId: string; sequenceNumber: string } | undefined;
    for (let i = 1; i <= 21; i++) {
      lastEvent = await appendTick(projectId, rawKey, 'ord_snap', i);
    }

    // The threshold trigger fires once 20 events have accumulated, but the
    // actual snapshot write happens asynchronously in the queue worker - by
    // the time it runs, more events may already have landed (here, the loop
    // above keeps appending while the worker processes in the background).
    // The snapshot is only ever guaranteed to be at "the latest sequence as
    // of whenever the worker ran", not exactly at the triggering sequence -
    // see SnapshotsService.createSnapshot's docstring.
    const snapshot = await waitForSnapshot(lastEvent!.aggregateId);
    const snapshotSequence = Number(snapshot.sequenceNumber.toString());
    expect(snapshotSequence).toBeGreaterThanOrEqual(20);
    expect(snapshotSequence).toBeLessThanOrEqual(21);
    expect(snapshot.state).toEqual({ n: snapshotSequence });

    const stateAtLatest = await request(app.getHttpServer())
      .get(
        `/v1/projects/${projectId}/aggregates/${lastEvent!.aggregateId}/state`,
      )
      .set('Authorization', `Bearer ${rawKey}`)
      .expect(200);
    expect((stateAtLatest.body as { state: { n: number } }).state).toEqual({
      n: 21,
    });

    const stateBeforeSnapshot = await request(app.getHttpServer())
      .get(
        `/v1/projects/${projectId}/aggregates/${lastEvent!.aggregateId}/state?asOfSequence=15`,
      )
      .set('Authorization', `Bearer ${rawKey}`)
      .expect(200);
    expect(
      (stateBeforeSnapshot.body as { state: { n: number } }).state,
    ).toEqual({ n: 15 });
  }, 15000);

  it('runs a replay job scoped to an aggregateType, creating fresh snapshots and reporting a summary', async () => {
    const { projectId, rawKey } = await bootstrapProject();
    await registerReducer(projectId, rawKey);

    await appendTick(projectId, rawKey, 'ord_a', 1);
    await appendTick(projectId, rawKey, 'ord_b', 1);

    const createRes = await request(app.getHttpServer())
      .post(`/v1/projects/${projectId}/replay-jobs`)
      .set('Authorization', `Bearer ${rawKey}`)
      .send({ aggregateType: 'order' })
      .expect(201);

    const job = createRes.body as { id: string; status: string };
    expect(job.status).toBe('pending');

    const finished = await waitForJobCompletion(projectId, rawKey, job.id);
    expect(finished).toMatchObject({
      status: 'completed',
      result: { aggregatesProcessed: 2, snapshotsCreated: 2, failures: [] },
    });
  }, 15000);

  it('running a replay job twice with no new events in between is a safe no-op the second time', async () => {
    const { projectId, rawKey } = await bootstrapProject();
    await registerReducer(projectId, rawKey);
    await appendTick(projectId, rawKey, 'ord_repeat', 1);

    const first = await request(app.getHttpServer())
      .post(`/v1/projects/${projectId}/replay-jobs`)
      .set('Authorization', `Bearer ${rawKey}`)
      .send({})
      .expect(201);
    await waitForJobCompletion(
      projectId,
      rawKey,
      (first.body as { id: string }).id,
    );

    const second = await request(app.getHttpServer())
      .post(`/v1/projects/${projectId}/replay-jobs`)
      .set('Authorization', `Bearer ${rawKey}`)
      .send({})
      .expect(201);
    const finished = await waitForJobCompletion(
      projectId,
      rawKey,
      (second.body as { id: string }).id,
    );

    expect(finished).toMatchObject({
      status: 'completed',
      result: { aggregatesProcessed: 1, snapshotsCreated: 0, failures: [] },
    });
  }, 15000);

  it('rejects replay job access with a key from a different project', async () => {
    const { projectId, rawKey } = await bootstrapProject();
    const { rawKey: otherKey } = await bootstrapProject();
    await registerReducer(projectId, rawKey);
    await appendTick(projectId, rawKey, 'ord_iso', 1);

    const createRes = await request(app.getHttpServer())
      .post(`/v1/projects/${projectId}/replay-jobs`)
      .set('Authorization', `Bearer ${rawKey}`)
      .send({})
      .expect(201);
    const jobId = (createRes.body as { id: string }).id;

    await request(app.getHttpServer())
      .get(`/v1/projects/${projectId}/replay-jobs/${jobId}`)
      .set('Authorization', `Bearer ${otherKey}`)
      .expect(403);

    await request(app.getHttpServer())
      .post(`/v1/projects/${projectId}/replay-jobs`)
      .set('Authorization', `Bearer ${otherKey}`)
      .send({})
      .expect(403);

    // Wait for the async replay job to finish before afterEach's cleanup
    // runs, otherwise the worker can still be writing a Snapshot row (or
    // reading the aggregate it references) when cleanup deletes it,
    // racing a foreign key violation on fk_snapshots_aggregate_project.
    await waitForJobCompletion(projectId, rawKey, jobId);
  }, 15000);
});
