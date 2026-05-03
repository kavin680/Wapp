---
name: testing-backend
description: Test the Wapp enterprise messaging backend end-to-end. Use when verifying backend API changes, new features, or bug fixes.
---

# Testing the Wapp Backend

## Environment Setup

### Required Services
1. **PostgreSQL** on localhost:5432
   ```bash
   docker run -d --name test-postgres -e POSTGRES_PASSWORD=password -e POSTGRES_DB=enterprise_db -p 5432:5432 postgres:15
   ```
2. **Redis** on localhost:6379
   ```bash
   redis-server --daemonize yes
   # or: docker run -d --name test-redis -p 6379:6379 redis:7-alpine
   ```

### Database Setup
```bash
cd backend-api
npx prisma db push
npx prisma db seed
```

### Start Dev Server
```bash
npm run start:dev
# For queue testing: QUEUE_ENABLED=true npm run start:dev
```

## API Routes

All routes use prefix `/api/v1/`. Example: `http://localhost:3000/api/v1/health/ping`

Swagger docs at: `http://localhost:3000/docs`

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin (SUPER_ADMIN) | admin@enterprise.com | Admin@123456 |
| User (USER) | user@enterprise.com | Admin@123456 |

## Devin Secrets Needed

No external secrets are required for local testing. All testing uses local PostgreSQL, Redis, and mock WhatsApp provider responses.

## Authentication Pattern

```bash
# Get JWT token
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@enterprise.com","password":"Admin@123456"}' \
  | jq -r '.data.accessToken')

# Use token for authenticated requests
curl -s http://localhost:3000/api/v1/messaging/providers \
  -H "Authorization: Bearer $TOKEN"
```

## Key Testing Patterns

### Message Sending
- Without real WhatsApp credentials, message send returns HTTP 200 with `result.success: false` — this is **expected graceful failure**, NOT a bug
- A message record and conversation are always created regardless of provider success
- With `QUEUE_ENABLED=true`, response contains `{queued: true}` and no `result` field

### Credential Encryption
- Provider credentials are encrypted with AES-256-GCM on configure
- Stored format: `iv_hex:tag_hex:ciphertext_hex` (string)
- Decrypted automatically on read via `GET /messaging/providers/:id/config`
- Verify by checking that stored value is a hex string, and read-back returns original JSON

### Campaign Lifecycle
- Campaign start/pause/cancel use **PATCH** method (not POST)
- Routes: `PATCH /campaigns/:id/start`, `PATCH /campaigns/:id/pause`, `PATCH /campaigns/:id/cancel`
- Campaign stats: `GET /campaigns/:id/stats`

### Media Upload
- Route: `POST /media/upload` with `multipart/form-data`
- Allowed MIME types: jpeg, png, gif, webp, pdf, csv, json, xlsx, docx
- Use `application/json` files for easy testing: `echo '{"test":true}' > test.json`

### RBAC Testing
- Admin endpoints (provider CRUD, etc.) require ADMIN or SUPER_ADMIN role
- USER role gets HTTP 403 with `"You do not have the required role"`

## Running Automated Tests

```bash
# Unit tests (145 tests, 19 suites)
npm run test

# E2E tests (55 tests) — REQUIRES clean database
npx prisma db push --force-reset --accept-data-loss
npx prisma db seed
npm run test:e2e

# Build
npm run build

# Lint (0 errors expected, ~200 pre-existing warnings)
npm run lint
```

## Common Gotchas

1. **E2E tests fail with 409 Conflict**: The E2E test suite creates its own test data. If you ran manual curl tests first, the database has duplicate records. Solution: reset the database before running E2E tests.

2. **Redis version warning**: BullMQ warns about minimum Redis 6.2.0. Redis 6.0.x works but shows warnings. Not a blocker.

3. **Campaign scheduler runs on startup**: The scheduler polls every 60s for scheduled campaigns. You'll see `Campaign scheduler started (interval: 60000ms)` in server logs — this is normal.

4. **No CI on the repo**: The CI workflow file is at `docs/ci-workflow.yml` (OAuth token lacks `workflow` scope to push to `.github/workflows/`). The user needs to manually copy it.

5. **Queue testing**: Set `QUEUE_ENABLED=true` as an environment variable when starting the server. The `.env` file has it set to `false` by default.

6. **Swagger UI**: Available at `/docs` (not under the `/api/v1` prefix). Works in development mode only.
