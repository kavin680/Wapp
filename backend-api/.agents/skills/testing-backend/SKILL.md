---
name: testing-backend
description: How to start, test, and debug the enterprise NestJS backend with the messaging platform modules.
---

# Testing the Enterprise NestJS Backend

## Quick Start

1. Start Docker databases:
   ```bash
   cd /home/ubuntu/repos/Wapp/backend-api
   docker compose -f docker-compose.dev.yml up -d
   ```
2. Wait for PostgreSQL health check to pass (~10s)
3. Push Prisma schema and seed:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```
4. Start dev server:
   ```bash
   npm run start:dev
   ```
5. Server runs on `http://localhost:3000`
6. Swagger UI at `http://localhost:3000/docs`

## Test Credentials (Seeded)

| Email | Password | Role |
|---|---|---|
| admin@enterprise.com | Admin@123456 | SUPER_ADMIN |
| user@enterprise.com | Admin@123456 | USER |

## Key API Endpoints

### Core Endpoints
- `GET /api/v1/health/ping` — Public, returns `{success: true, data: {status: "ok"}}`
- `GET /api/v1/health` — Public, includes database status
- `POST /api/v1/auth/register` — Public, requires email, password, firstName, lastName
- `POST /api/v1/auth/login` — Public, returns accessToken + refreshToken
- `GET /api/v1/auth/me` — Requires Bearer token
- `POST /api/v1/auth/refresh` — Accepts refreshToken in body
- `GET /api/v1/users` — Requires ADMIN or SUPER_ADMIN role

### Messaging Platform Endpoints

| Module | Base Path | Key Operations |
|--------|-----------|----------------|
| Messaging Providers | `/api/v1/messaging/providers` | CRUD, configure, send messages, webhooks |
| Contacts | `/api/v1/contacts` | CRUD, opt-in/opt-out, bulk import |
| Conversations | `/api/v1/conversations` | Inbox, message threading, close/reopen |
| Templates | `/api/v1/templates` | CRUD, provider submission |
| Campaigns | `/api/v1/campaigns` | CRUD, add recipients, stats, pause/cancel |
| API Keys | `/api/v1/api-keys` | Generate, list, revoke |
| Settings | `/api/v1/settings/system`, `/api/v1/settings/preferences` | System settings (admin), user prefs |
| Analytics | `/api/v1/analytics/dashboard` | Dashboard, volume, delivery rates |
| Billing | `/api/v1/billing/summary` | Usage summary, per-channel breakdown |
| Webhook Events | `/api/v1/webhook-events` | Event log, stats |

### Recommended E2E Test Flow

1. Login as admin → get token
2. Create a messaging provider (type: WHATSAPP)
3. Configure the provider (phoneNumberId, businessAccountId, etc.)
4. Create a contact (phone, name, tags)
5. Send a message (will fail gracefully without real WhatsApp creds — returns 200 with `success: false`)
6. Verify conversation was auto-created (`GET /conversations`)
7. Verify message appears in conversation thread (`GET /conversations/{id}/messages`)
8. Create a campaign, add recipient, check stats
9. Test RBAC: login as USER, verify 403 on admin endpoints

## RBAC Testing

- USER role gets 403 on `/api/v1/users` and `/api/v1/settings/system` (admin-only endpoints)
- SUPER_ADMIN can access all endpoints
- Test by logging in with different seeded accounts and using the returned accessToken

## Swagger UI Testing

- Navigate to `http://localhost:3000/docs`
- Use "Authorize" button (top right) to set Bearer token for protected endpoints
- Expected sections: Analytics & Reporting, API Key Management, Audit, Auth, Billing & Usage Tracking, Campaign Management, Contact Management, Conversation Inbox, Health, Messaging Provider & Message Sending, System Settings & User Preferences, Message Template Management, Users, Webhook Event Processing
- Use "Try it out" → "Execute" to test endpoints directly

## Known Gotchas

- **Docker compose path**: Run `docker compose` from `/home/ubuntu/repos/Wapp/backend-api` (not `/home/ubuntu/repos/backend`)
- **DTO validation with `forbidNonWhitelisted: true`**: The ValidationPipe in `main.ts` is configured with `whitelist: true` and `forbidNonWhitelisted: true`. Every property in a DTO must have at least one class-validator decorator or it will be rejected with 400. For `unknown`-typed fields (like `value` in Settings DTOs), use `@Allow()` from `class-validator`.
- **Send message without WhatsApp credentials**: Returns 200 with message record created but `result.success = false`, `failedAt` set, and error details populated. This is expected behavior — the implementation handles provider failures gracefully.
- **Cache module type errors**: If the cache module's `useFactory` returns a conditional/union type, TypeScript might reject it. The fix is to use a single `Record<string, unknown>` object and conditionally add properties rather than returning different object shapes.
- **Prisma version**: This project uses Prisma v5 (not v7). If you see schema syntax errors about `datasource url`, check the Prisma version.
- **Optional services disabled by default**: Redis (`REDIS_ENABLED=false`), Mail (`MAIL_ENABLED=false`), Queue (`QUEUE_ENABLED=false`) are all disabled in `.env`. The app runs fine without them.
- **GitHub Actions CI workflow**: Located at `docs/ci-workflow.yml` (not `.github/workflows/`) due to OAuth scope limitations. Must be copied manually.
- **Password validation**: Passwords must contain uppercase, lowercase, number, and special character. Example valid password: `Test@12345`

## Devin Secrets Needed

No secrets are required for local testing. The `.env` file is generated from `.env.example` with default values. Docker databases use default credentials (postgres/password).
