import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Organization API (e2e)', () => {
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

  it('creates an organization with a first project and API key, then fetches it with that key', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/organizations')
      .send({ name: 'Acme Corp E2E', firstProject: { name: 'Payments' } })
      .expect(201);

    const body = createRes.body as {
      organization: { id: string; name: string };
      project: { id: string; organizationId: string };
      apiKey: { id: string; prefix: string; rawKey: string };
    };
    organizationIds.push(body.organization.id);

    expect(body.organization.name).toBe('Acme Corp E2E');
    expect(body.project.organizationId).toBe(body.organization.id);
    expect(body.apiKey.rawKey).toEqual(expect.stringMatching(/^rk_/));

    await request(app.getHttpServer())
      .get(`/v1/organizations/${body.organization.id}`)
      .set('Authorization', `Bearer ${body.apiKey.rawKey}`)
      .expect(200)
      .expect(({ body: org }) => {
        expect(org).toEqual(
          expect.objectContaining({
            id: body.organization.id,
            name: 'Acme Corp E2E',
          }),
        );
      });
  });

  it('creates an organization without a first project when firstProject is omitted', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/organizations')
      .send({ name: 'Bare Org E2E' })
      .expect(201);

    const body = createRes.body as {
      organization: { id: string; name: string };
      project?: unknown;
      apiKey?: unknown;
    };
    organizationIds.push(body.organization.id);

    expect(body.organization.name).toBe('Bare Org E2E');
    expect(body.project).toBeUndefined();
    expect(body.apiKey).toBeUndefined();
  });

  it('rejects GET /v1/organizations/:id without a valid API key', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/v1/organizations')
      .send({ name: 'Locked Org E2E', firstProject: { name: 'Core' } })
      .expect(201);

    const body = createRes.body as { organization: { id: string } };
    organizationIds.push(body.organization.id);

    await request(app.getHttpServer())
      .get(`/v1/organizations/${body.organization.id}`)
      .expect(401);
  });
});
