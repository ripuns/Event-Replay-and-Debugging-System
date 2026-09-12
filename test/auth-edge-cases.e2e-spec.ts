import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth edge cases (e2e)', () => {
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

  async function bootstrapProject() {
    const res = await request(app.getHttpServer())
      .post('/v1/organizations')
      .send({
        name: `Auth Edge Cases Org ${Date.now()}`,
        firstProject: { name: 'Orders' },
      })
      .expect(201);

    const body = res.body as {
      organization: { id: string };
      project: { id: string };
      apiKey: { id: string; rawKey: string };
    };
    organizationIds.push(body.organization.id);
    return {
      projectId: body.project.id,
      apiKeyId: body.apiKey.id,
      rawKey: body.apiKey.rawKey,
    };
  }

  it('rejects a revoked API key with 401', async () => {
    const { projectId, apiKeyId, rawKey } = await bootstrapProject();

    // Sanity check: the key works before revocation.
    await request(app.getHttpServer())
      .get(`/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${rawKey}`)
      .expect(200);

    await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { revokedAt: new Date() },
    });

    await request(app.getHttpServer())
      .get(`/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${rawKey}`)
      .expect(401);
  });

  it('rejects an expired API key with 401', async () => {
    const { projectId, apiKeyId, rawKey } = await bootstrapProject();

    await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    await request(app.getHttpServer())
      .get(`/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${rawKey}`)
      .expect(401);
  });

  it('accepts an API key with a future expiry', async () => {
    const { projectId, apiKeyId, rawKey } = await bootstrapProject();

    await prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    });

    await request(app.getHttpServer())
      .get(`/v1/projects/${projectId}`)
      .set('Authorization', `Bearer ${rawKey}`)
      .expect(200);
  });

  it('rejects malformed Authorization headers with 401', async () => {
    const { projectId, rawKey } = await bootstrapProject();

    await request(app.getHttpServer())
      .get(`/v1/projects/${projectId}`)
      .set('Authorization', rawKey) // missing "Bearer " prefix
      .expect(401);

    await request(app.getHttpServer())
      .get(`/v1/projects/${projectId}`)
      .set('Authorization', 'Bearer ')
      .expect(401);

    await request(app.getHttpServer())
      .get(`/v1/projects/${projectId}`)
      .set('Authorization', 'Basic sometoken')
      .expect(401);
  });

  it('rejects a well-formed but nonexistent API key with 401', async () => {
    const { projectId } = await bootstrapProject();

    await request(app.getHttpServer())
      .get(`/v1/projects/${projectId}`)
      .set(
        'Authorization',
        'Bearer rk_doesnotexist00000000000000000000000000000',
      )
      .expect(401);
  });
});
