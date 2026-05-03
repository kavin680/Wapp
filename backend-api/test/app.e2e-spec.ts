import { Test, TestingModule } from '@nestjs/testing';
import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/http-exception.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('Enterprise Backend (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Health ───────────────────────────────────────────────

  describe('Health', () => {
    it('GET /api/v1/health/ping — returns ok', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/ping')
        .expect(200)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.status).toBe('ok');
          expect(res.body.data.uptime).toBeDefined();
          expect(res.body.requestId).toBeDefined();
          expect(res.body.timestamp).toBeDefined();
        });
    });

    it('GET /api/v1/health — database health check', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.data.status).toBe('ok');
          expect(res.body.data.info.database.status).toBe('up');
        });
    });
  });

  // ─── Auth ─────────────────────────────────────────────────

  describe('Auth', () => {
    const uniqueEmail = `e2e-${Date.now()}@test.com`;

    it('POST /api/v1/auth/register — validation errors on bad input', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'bad' })
        .expect(400)
        .expect((res) => {
          expect(res.body.success).toBe(false);
          expect(res.body.message).toBe('Validation failed');
          expect(Array.isArray(res.body.details)).toBe(true);
        });
    });

    it('POST /api/v1/auth/register — registers a new user', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: uniqueEmail,
          password: 'Test@12345',
          firstName: 'E2E',
          lastName: 'Test',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.success).toBe(true);
          expect(res.body.data.userId).toBeDefined();
          expect(res.body.data).not.toHaveProperty('password');
        });
    });

    it('POST /api/v1/auth/register — rejects duplicate email', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: uniqueEmail,
          password: 'Test@12345',
          firstName: 'E2E',
          lastName: 'Test',
        })
        .expect(409);
    });

    it('POST /api/v1/auth/login — rejects invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'nobody@test.com', password: 'Wrong@12345' })
        .expect(401);
    });

    it('POST /api/v1/auth/login — admin login returns tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'admin@enterprise.com', password: 'Admin@123456' })
        .expect(200);

      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.refreshToken).toBeDefined();
      expect(res.body.data.sessionId).toBeDefined();
      expect(res.body.data.user.role).toBe('SUPER_ADMIN');
      adminToken = res.body.data.accessToken;
    });

    it('POST /api/v1/auth/login — user login returns tokens', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'user@enterprise.com', password: 'Admin@123456' })
        .expect(200);

      expect(res.body.data.user.role).toBe('USER');
      userToken = res.body.data.accessToken;
    });

    it('GET /api/v1/auth/me — returns current user profile', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.email).toBe('admin@enterprise.com');
          expect(res.body.data).not.toHaveProperty('password');
        });
    });

    it('GET /api/v1/auth/me — rejects unauthenticated request', () => {
      return request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });
  });

  // ─── RBAC ─────────────────────────────────────────────────

  describe('RBAC', () => {
    it('GET /api/v1/users — USER role gets 403', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('GET /api/v1/users — SUPER_ADMIN gets paginated list', () => {
      return request(app.getHttpServer())
        .get('/api/v1/users?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.meta).toBeDefined();
          expect(res.body.meta.page).toBe(1);
          expect(res.body.meta.total).toBeGreaterThanOrEqual(2);
        });
    });
  });

  // ─── Feature Flags ────────────────────────────────────────

  describe('Feature Flags', () => {
    let flagId: string;

    it('GET /api/v1/feature-flags — USER gets 403', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feature-flags')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('POST /api/v1/feature-flags — creates a flag', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          key: 'e2e-test-flag',
          name: 'E2E Test Flag',
          description: 'E2E test flag',
          enabled: false,
        })
        .expect(201);

      flagId = res.body.data.id;
      expect(flagId).toBeDefined();
    });

    it('POST /api/v1/feature-flags — rejects invalid key format', () => {
      return request(app.getHttpServer())
        .post('/api/v1/feature-flags')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ key: 'INVALID KEY', description: 'Bad', enabled: false })
        .expect(400);
    });

    it('GET /api/v1/feature-flags — returns paginated list', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feature-flags?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.meta).toBeDefined();
          expect(res.body.meta.page).toBe(1);
        });
    });

    it('POST /api/v1/feature-flags/:id/toggle — toggles flag', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/feature-flags/${flagId}/toggle`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body.data.enabled).toBe(true);
    });

    it('GET /api/v1/feature-flags/check — any user can check', () => {
      return request(app.getHttpServer())
        .get('/api/v1/feature-flags/check?key=nonexistent-flag')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.enabled).toBe(false);
        });
    });

    it('DELETE /api/v1/feature-flags/:id — deletes flag', () => {
      return request(app.getHttpServer())
        .delete(`/api/v1/feature-flags/${flagId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  // ─── Notifications ────────────────────────────────────────

  describe('Notifications', () => {
    let notificationId: string;

    it('POST /api/v1/notifications — admin creates notification', async () => {
      const meRes = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      const userId = meRes.body.data.sub;

      const res = await request(app.getHttpServer())
        .post('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'E2E Test Notification',
          type: 'SYSTEM',
          message: 'Test notification body',
          userId,
        });

      expect(res.status).toBe(201);

      notificationId = res.body.data.id;
      expect(notificationId).toBeDefined();
    });

    it('GET /api/v1/notifications — returns paginated list', () => {
      return request(app.getHttpServer())
        .get('/api/v1/notifications?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.meta).toBeDefined();
          expect(res.body.meta.page).toBe(1);
        });
    });

    it('GET /api/v1/notifications/unread-count — returns count', () => {
      return request(app.getHttpServer())
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.count).toBeGreaterThanOrEqual(1);
        });
    });

    it('PATCH /api/v1/notifications/:id/read — marks as read', () => {
      return request(app.getHttpServer())
        .patch(`/api/v1/notifications/${notificationId}/read`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('POST /api/v1/notifications/read-all — marks all as read', () => {
      return request(app.getHttpServer())
        .post('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);
    });
  });

  // ─── Webhooks ─────────────────────────────────────────────

  describe('Webhooks', () => {
    let webhookId: string;

    it('GET /api/v1/webhooks — USER gets 403', () => {
      return request(app.getHttpServer())
        .get('/api/v1/webhooks')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });

    it('POST /api/v1/webhooks — creates webhook with auto-generated secret', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/webhooks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Test Webhook',
          url: 'https://httpbin.org/post',
          events: ['user.created'],
        })
        .expect(201);

      webhookId = res.body.data.id;
      expect(webhookId).toBeDefined();
      expect(res.body.data.secret).toMatch(/^whsec_/);
    });

    it('GET /api/v1/webhooks — returns paginated list', () => {
      return request(app.getHttpServer())
        .get('/api/v1/webhooks?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.meta).toBeDefined();
          expect(res.body.meta.page).toBe(1);
        });
    });

    it('GET /api/v1/webhooks/:id — returns webhook detail with secret', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/webhooks/${webhookId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.secret).toMatch(/^whsec_/);
        });
    });

    it('GET /api/v1/webhooks/:id/logs — returns paginated logs', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/webhooks/${webhookId}/logs?page=1&limit=5`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.meta).toBeDefined();
        });
    });

    it('DELETE /api/v1/webhooks/:id — deletes webhook', () => {
      return request(app.getHttpServer())
        .delete(`/api/v1/webhooks/${webhookId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('GET /api/v1/webhooks/:id — 404 after delete', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/webhooks/${webhookId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  // ─── File Upload ──────────────────────────────────────────

  describe('File Upload', () => {
    let fileId: string;

    it('POST /api/v1/files/upload — uploads a file', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/files/upload')
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', Buffer.from('e2e test content'), {
          filename: 'test.csv',
          contentType: 'text/csv',
        })
        .expect(201);

      fileId = res.body.data.id;
      expect(fileId).toBeDefined();
      expect(res.body.data.originalName).toBe('test.csv');
    });

    it('GET /api/v1/files — returns paginated file list', () => {
      return request(app.getHttpServer())
        .get('/api/v1/files?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.meta).toBeDefined();
          expect(res.body.meta.page).toBe(1);
        });
    });

    it('GET /api/v1/files/:id — returns file metadata', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/files/${fileId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.id).toBe(fileId);
          expect(res.body.data.mimeType).toBe('text/csv');
        });
    });

    it('DELETE /api/v1/files/:id — deletes file', () => {
      return request(app.getHttpServer())
        .delete(`/api/v1/files/${fileId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('GET /api/v1/files/:id — 404 after delete', () => {
      return request(app.getHttpServer())
        .get(`/api/v1/files/${fileId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  // ─── Audit ────────────────────────────────────────────────

  describe('Audit', () => {
    it('GET /api/v1/audit — returns paginated audit logs', () => {
      return request(app.getHttpServer())
        .get('/api/v1/audit?page=1&limit=5')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.meta).toBeDefined();
          expect(res.body.meta.page).toBe(1);
        });
    });

    it('GET /api/v1/audit/:id — 404 for non-existent', () => {
      return request(app.getHttpServer())
        .get('/api/v1/audit/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  // ─── Messaging Platform ─────────────────────────────────────

  describe('Messaging Platform', () => {
    let providerId: string;
    let contactId: string;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    let templateId: string;
    let campaignId: string;

    it('POST /api/v1/messaging/providers — creates a provider', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/messaging/providers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'WhatsApp Cloud API',
          type: 'WHATSAPP',
          description: 'E2E test provider',
          isActive: true,
        })
        .expect(201);

      expect(res.body.data.type).toBe('WHATSAPP');
      expect(res.body.data.isActive).toBe(true);
      providerId = res.body.data.id;
    });

    it('GET /api/v1/messaging/providers — lists providers', () => {
      return request(app.getHttpServer())
        .get('/api/v1/messaging/providers')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body.data)).toBe(true);
          expect(res.body.data.length).toBeGreaterThan(0);
        });
    });

    it('POST /api/v1/messaging/providers/:id/configure — configures provider', async () => {
      const res = await request(app.getHttpServer())
        .post(`/api/v1/messaging/providers/${providerId}/configure`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          credentials: { apiToken: 'test-token' },
          settings: { rateLimit: 80 },
          phoneNumberId: '123456',
          businessAccountId: '789012',
        })
        .expect(201);

      expect(res.body.data.phoneNumberId).toBe('123456');
      expect(res.body.data.webhookSecret).toMatch(/^whsec_/);
    });

    it('POST /api/v1/contacts — creates a contact', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/contacts')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          phoneNumber: '+1234567890',
          firstName: 'E2E',
          lastName: 'Contact',
          tags: ['test'],
        })
        .expect(201);

      expect(res.body.data.phoneNumber).toBe('+1234567890');
      contactId = res.body.data.id;
    });

    it('PATCH /api/v1/contacts/:id/opt-in — opt in contact', () => {
      return request(app.getHttpServer())
        .patch(`/api/v1/contacts/${contactId}/opt-in`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.optInStatus).toBe('OPTED_IN');
        });
    });

    it('POST /api/v1/templates — creates a template', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          providerId,
          name: 'e2e_welcome',
          language: 'en',
          category: 'MARKETING',
          bodyContent: 'Hello {{1}}, welcome!',
        })
        .expect(201);

      expect(res.body.data.name).toBe('e2e_welcome');
      templateId = res.body.data.id;
    });

    it('POST /api/v1/messaging/send — sends a message (graceful failure)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/messaging/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          to: '+1234567890',
          type: 'TEXT',
          content: { body: 'Hello from E2E test' },
          providerId,
        })
        .expect(200);

      expect(res.body.data.message.direction).toBe('OUTBOUND');
    });

    it('GET /api/v1/conversations — auto-created conversation exists', () => {
      return request(app.getHttpServer())
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data.length).toBeGreaterThan(0);
        });
    });

    it('POST /api/v1/campaigns — creates a campaign', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          providerId,
          name: 'E2E Test Campaign',
          description: 'Test campaign from E2E',
          channel: 'WHATSAPP',
        })
        .expect(201);

      expect(res.body.data.name).toBe('E2E Test Campaign');
      expect(res.body.data.status).toBe('DRAFT');
      campaignId = res.body.data.id;
    });

    it('POST /api/v1/campaigns/:id/recipients — adds recipients', () => {
      return request(app.getHttpServer())
        .post(`/api/v1/campaigns/${campaignId}/recipients`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ contactIds: [contactId] })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.added).toBe(1);
        });
    });

    it('POST /api/v1/api-keys — generates an API key', () => {
      return request(app.getHttpServer())
        .post('/api/v1/api-keys')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'E2E Test Key',
          scopes: ['messaging:send'],
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.key).toBeDefined();
          expect(res.body.data.scopes).toContain('messaging:send');
        });
    });

    it('POST /api/v1/settings/system — creates a system setting', () => {
      return request(app.getHttpServer())
        .post('/api/v1/settings/system')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          category: 'messaging',
          key: `e2e_retry_${Date.now()}`,
          value: 5,
          description: 'E2E test setting',
          isPublic: false,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.data.value).toBe(5);
        });
    });

    it('GET /api/v1/analytics/dashboard — returns analytics', () => {
      return request(app.getHttpServer())
        .get('/api/v1/analytics/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.data).toHaveProperty('messages');
          expect(res.body.data).toHaveProperty('conversations');
        });
    });

    it('GET /api/v1/billing/summary — returns billing data', () => {
      return request(app.getHttpServer())
        .get('/api/v1/billing/summary')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });

    it('GET /api/v1/settings/system — USER role gets 403', () => {
      return request(app.getHttpServer())
        .get('/api/v1/settings/system')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);
    });
  });

  // ─── Response Structure ───────────────────────────────────

  describe('Response Structure', () => {
    it('all success responses follow standard structure', () => {
      return request(app.getHttpServer())
        .get('/api/v1/health/ping')
        .expect((res) => {
          expect(res.body).toHaveProperty('success', true);
          expect(res.body).toHaveProperty('statusCode', 200);
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('data');
          expect(res.body).toHaveProperty('requestId');
          expect(res.body).toHaveProperty('timestamp');
        });
    });

    it('all error responses follow standard structure', () => {
      return request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect((res) => {
          expect(res.body).toHaveProperty('success', false);
          expect(res.body).toHaveProperty('statusCode');
          expect(res.body).toHaveProperty('message');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('path');
        });
    });
  });
});
