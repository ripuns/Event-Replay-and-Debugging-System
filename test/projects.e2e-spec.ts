import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Projects API (e2e)', () => {
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

  async function bootstrapOrgWithProject(orgName: string, projectName: string) {
    const res = await request(app.getHttpServer())
      .post('/v1/organizations')
      .send({ name: orgName, firstProject: { name: projectName } })
      .expect(201);

    const body = res.body as {
      organization: { id: string };
      project: { id: string };
      apiKey: { rawKey: string };
    };
    organizationIds.push(body.organization.id);
    return body;
  }

  it('creates a second project in the same org using an existing key, and both keys stay scoped to their own project', async () => {
    const {
      organization,
      project: firstProject,
      apiKey: firstKey,
    } = await bootstrapOrgWithProject('Multi-Project Org E2E', 'Payments');

    const secondRes = await request(app.getHttpServer())
      .post(`/v1/organizations/${organization.id}/projects`)
      .set('Authorization', `Bearer ${firstKey.rawKey}`)
      .send({ name: 'Billing' })
      .expect(201);

    const secondBody = secondRes.body as {
      project: { id: string; organizationId: string };
      apiKey: { rawKey: string };
    };
    expect(secondBody.project.organizationId).toBe(organization.id);

    await request(app.getHttpServer())
      .get(`/v1/projects/${secondBody.project.id}`)
      .set('Authorization', `Bearer ${secondBody.apiKey.rawKey}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/v1/projects/${secondBody.project.id}`)
      .set('Authorization', `Bearer ${firstKey.rawKey}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/v1/projects/${firstProject.id}`)
      .set('Authorization', `Bearer ${secondBody.apiKey.rawKey}`)
      .expect(403);
  });

  it('rejects creating a project without a key, or with a key from a different org', async () => {
    const { organization } = await bootstrapOrgWithProject(
      'Org A E2E',
      'Core A',
    );
    const { apiKey: otherOrgKey } = await bootstrapOrgWithProject(
      'Org B E2E',
      'Core B',
    );

    await request(app.getHttpServer())
      .post(`/v1/organizations/${organization.id}/projects`)
      .send({ name: 'ShouldFailNoAuth' })
      .expect(401);

    await request(app.getHttpServer())
      .post(`/v1/organizations/${organization.id}/projects`)
      .set('Authorization', `Bearer ${otherOrgKey.rawKey}`)
      .send({ name: 'ShouldFailWrongOrg' })
      .expect(403);
  });

  it('mints an additional API key for a project using an existing key for that project', async () => {
    const { project, apiKey } = await bootstrapOrgWithProject(
      'Key Minting Org E2E',
      'Core',
    );

    const res = await request(app.getHttpServer())
      .post(`/v1/projects/${project.id}/api-keys`)
      .set('Authorization', `Bearer ${apiKey.rawKey}`)
      .send({ name: 'Second key' })
      .expect(201);

    const body = res.body as { id: string; prefix: string; rawKey: string };
    expect(body.rawKey).toEqual(expect.stringMatching(/^rk_/));
    expect(body.rawKey).not.toBe(apiKey.rawKey);

    await request(app.getHttpServer())
      .get(`/v1/projects/${project.id}`)
      .set('Authorization', `Bearer ${body.rawKey}`)
      .expect(200);
  });
});
