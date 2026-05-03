# Deployment Guide

## Quick Start (Docker)

```bash
cd backend-api

# Copy and configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY

# Start all services (PostgreSQL + Redis + API)
docker compose up -d

# Initialize database
docker compose exec api npx prisma db push
docker compose exec api npx ts-node src/database/seeds/seed.ts

# Verify
curl http://localhost:3000/api/v1/health/ping
```

## Docker Architecture

### Multi-Stage Dockerfile

The Dockerfile uses a two-stage build:

```
Stage 1 (builder):
  - Installs all dependencies (including devDependencies)
  - Generates Prisma client
  - Compiles TypeScript → JavaScript

Stage 2 (production):
  - Installs only production dependencies
  - Copies compiled JS + Prisma client from builder
  - Runs as non-root user (node)
  - Uses dumb-init for proper signal handling
  - Includes health check
```

### docker-compose.yml Services

| Service | Image | Ports | Volumes |
|---------|-------|-------|---------|
| `postgres` | postgres:15-alpine | 5432 | postgres_data |
| `redis` | redis:7-alpine | 6379 | redis_data |
| `api` | Built from Dockerfile | 3000 | uploads |

All services have health checks and automatic restart (`unless-stopped`).

### Building Manually

```bash
# Build production image
docker build -t enterprise-api .

# Run standalone (requires external PostgreSQL + Redis)
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e JWT_SECRET="..." \
  -e JWT_REFRESH_SECRET="..." \
  -e ENCRYPTION_KEY="..." \
  -e REDIS_HOST="redis-host" \
  -e QUEUE_ENABLED="true" \
  enterprise-api
```

## Manual Deployment (No Docker)

### Prerequisites
- Node.js 20+ installed
- PostgreSQL 15+ running
- Redis 7+ running (for queues)

### Steps

```bash
# Install production dependencies
npm ci --omit=dev

# Generate Prisma client
npx prisma generate

# Push schema to database
DATABASE_URL="postgresql://..." npx prisma db push

# Seed database (first time only)
DATABASE_URL="postgresql://..." npx ts-node src/database/seeds/seed.ts

# Build
npm run build

# Start
NODE_ENV=production node dist/main
```

## Environment Variables

### Required (Production)

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Access token signing key (min 32 chars) | `generate with: openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | Refresh token signing key | `generate with: openssl rand -hex 32` |
| `ENCRYPTION_KEY` | AES-256 key for credential encryption | `generate with: openssl rand -hex 32` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Set to `production` |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `QUEUE_ENABLED` | `false` | Enable async message queues |
| `CORS_ORIGINS` | `*` | Comma-separated allowed origins |
| `CAMPAIGN_SCHEDULER_INTERVAL_MS` | `60000` | Campaign scheduler poll interval |

### Generating Secrets

```bash
# Generate JWT secrets
openssl rand -hex 32

# Generate encryption key
openssl rand -hex 32

# Or using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Health Checks

| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /api/v1/health/ping` | Liveness probe | `{ "status": "ok", "uptime": 123.45 }` |
| `GET /api/v1/health` | Readiness probe (checks DB + Redis) | `{ "status": "ok", "database": "connected" }` |

### Docker Health Check

The Dockerfile includes a built-in health check:
```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --spider http://localhost:3000/api/v1/health/ping || exit 1
```

### Kubernetes Probes

```yaml
livenessProbe:
  httpGet:
    path: /api/v1/health/ping
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 30

readinessProbe:
  httpGet:
    path: /api/v1/health
    port: 3000
  initialDelaySeconds: 15
  periodSeconds: 10
```

## CI/CD (GitHub Actions)

The CI workflow is provided at `docs/ci-workflow.yml`. To activate:

```bash
mkdir -p .github/workflows
cp docs/ci-workflow.yml .github/workflows/ci.yml
git add .github/workflows/ci.yml
git commit -m "ci: Add GitHub Actions workflow"
git push
```

### Pipeline Jobs

| Job | Trigger | Services | Steps |
|-----|---------|----------|-------|
| **lint-and-build** | Push/PR to main | None | `npm ci` → `prisma generate` → `lint` → `build` |
| **unit-tests** | Push/PR to main | None | `npm ci` → `prisma generate` → `test` |
| **e2e-tests** | Push/PR to main | PostgreSQL + Redis | `npm ci` → `prisma generate` → `db push` → `seed` → `test:e2e` |

## Scaling

### Horizontal Scaling

The API is stateless — scale behind a load balancer:

```
                    ┌─── API Server 1 ───┐
Load Balancer ──────┼─── API Server 2 ───┼──── PostgreSQL
                    └─── API Server 3 ───┘         │
                           │                       │
                         Redis ◄───────────────────┘
                           │
                    ┌─── Queue Worker 1
                    └─── Queue Worker 2
```

- **API servers**: Scale independently, share the same database
- **Queue workers**: Can run as separate processes connected to the same Redis
- **Database**: Use connection pooling (PgBouncer) for many API instances
- **Redis**: Single instance handles queues + cache; consider Redis Cluster for HA

### Queue Worker Scaling

Run additional queue workers as separate processes:

```bash
# Main API server (handles HTTP + queue processing)
node dist/main

# Additional queue worker (handles only queue processing)
# Create a queue-worker.ts entry point that only registers processors
```

### Database Optimization

- Add read replicas for analytics/reporting queries
- Use connection pooling (PgBouncer) when scaling beyond 10 API instances
- Key indexes are already defined on: `Message.conversationId`, `Campaign.status`, `Contact.userId_phoneNumber`

## Monitoring

### Structured Logging

All logs are structured JSON via Pino:

```json
{
  "level": 30,
  "time": 1234567890,
  "req": { "id": "uuid", "method": "POST", "url": "/api/v1/messaging/send" },
  "res": { "statusCode": 200 },
  "responseTime": 45
}
```

Pipe to log aggregation (ELK, Datadog, CloudWatch):
```bash
node dist/main | tee /var/log/api.log
```

### Queue Monitoring

Integrate [Bull Board](https://github.com/felixmosh/bull-board) or [Arena](https://github.com/bee-queue/arena) for queue dashboard:

```bash
npm install @bull-board/express @bull-board/api
```

### Metrics to Track

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| API response time | Pino logs | p95 > 500ms |
| Message send failures | `message.processed` events | > 5% failure rate |
| Queue depth | Redis `LLEN` | > 10,000 pending jobs |
| Database connections | PgBouncer stats | > 80% pool utilization |
| Campaign completion time | `campaign.completed` events | > 2x expected duration |

## Production Checklist

- [ ] Set strong JWT secrets (min 32 chars each)
- [ ] Set ENCRYPTION_KEY for credential encryption
- [ ] Set `NODE_ENV=production`
- [ ] Configure CORS origins (restrict from `*`)
- [ ] Enable QUEUE_ENABLED=true with Redis
- [ ] Configure SSL/TLS termination (nginx, Cloudflare, etc.)
- [ ] Set up database backups (pg_dump cron or managed DB)
- [ ] Configure log aggregation
- [ ] Set up monitoring and alerting
- [ ] Enable database connection pooling
- [ ] Review and set rate limiting thresholds
- [ ] Set up webhook endpoints with HTTPS
- [ ] Configure Meta webhook in developer dashboard
- [ ] Test graceful shutdown behavior
- [ ] Verify health check endpoints respond correctly
