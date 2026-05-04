# Enterprise Messaging Platform

A production-ready, enterprise-grade **multi-channel messaging platform** built with **NestJS**, **Prisma**, **PostgreSQL**, **Redis**, and **BullMQ**. Supports WhatsApp Cloud API with a plugin architecture ready for SMS, Email, Telegram, and more.

## Features

### Messaging Platform
- **Provider Plugin System** - Extensible multi-channel architecture (WhatsApp implemented, SMS/Email/Telegram ready)
- **Queue-Based Sending** - BullMQ async message processing with exponential backoff retry
- **Campaign Engine** - Scheduled campaigns with batch execution, pause/cancel, real-time stats
- **Credential Encryption** - AES-256-GCM encryption at rest for provider credentials
- **Media Management** - Upload, store, and link media assets (images, video, audio, documents)
- **Event Notifications** - EventEmitter2-driven notifications on message failures, campaign completion, incoming messages
- **Conversation Inbox** - Threaded conversations with assignment, archiving, read tracking
- **Contact Management** - CRUD with opt-in/opt-out consent tracking and bulk import
- **Template Management** - Message templates with approval workflow
- **Webhook Processing** - Incoming message handling, delivery status tracking, signature verification
- **Analytics Dashboard** - Message volume, delivery rates, campaign performance, provider health
- **Billing Tracking** - Usage metering for messages, campaigns, API calls
- **API Key Management** - Scoped keys with expiration for programmatic access

### Core Framework
- **Authentication** - JWT access/refresh tokens, registration, login, email verification, password reset, session tracking
- **Authorization** - Role-based access control (RBAC), granular permissions guards
- **Response System** - Standardized API responses, pagination metadata, request IDs
- **Exception Handling** - Global exception filter, custom error hierarchy, Prisma error mapping
- **Logging** - Structured JSON logging with Pino, sensitive data redaction
- **Audit System** - CRUD change tracking, security event logging, admin action audit trails
- **Database** - Prisma ORM with 15+ models, soft deletes, audit fields, seeders
- **Caching** - Redis cache (optional), in-memory fallback
- **Security** - Helmet, CORS, rate limiting, bcrypt hashing, input validation
- **API Documentation** - Swagger/OpenAPI auto-generated docs at `/docs`
- **Testing** - 47 unit tests + 55 E2E tests with full API coverage
- **DevOps** - Multi-stage Docker, Docker Compose, GitHub Actions CI/CD, health checks

## Quick Start

### Prerequisites

- Node.js 22+
- PostgreSQL 16+
- Redis 7+ (optional)
- Docker & Docker Compose (optional)

### Setup

```bash
# Clone the repository
git clone <repo-url> my-project
cd my-project

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Start development databases
npm run docker:dev

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:push

# Seed the database
npx prisma db seed

# Start development server
npm run start:dev
```

### Default Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@enterprise.com | Admin@123456 |
| User | user@enterprise.com | Admin@123456 |

### API Documentation

Once running, visit: `http://localhost:3000/docs`

## Project Structure

```
src/
├── common/                         # Shared infrastructure
│   ├── decorators/                 # @Roles, @Public, @CurrentUser, @Audit, @Permissions
│   ├── enums/                      # Role, Permission, AuditAction
│   ├── filters/                    # Global exception filter
│   ├── guards/                     # JWT, Roles, Permissions guards
│   ├── interceptors/               # Response, logging, audit interceptors
│   └── services/                   # EncryptionService, StorageService
├── config/                         # Typed config modules (app, auth, db, redis, messaging)
├── database/                       # Prisma service, seeds
├── modules/
│   ├── auth/                       # JWT authentication, sessions, password management
│   ├── users/                      # User CRUD
│   ├── health/                     # Health check endpoints
│   ├── audit/                      # Audit log management
│   ├── messaging/                  # Core messaging platform
│   │   ├── providers/              # Provider registry + WhatsApp implementation
│   │   ├── queues/                 # BullMQ message & campaign processors
│   │   └── listeners/             # Event-driven notification listeners
│   ├── contacts/                   # Contact management + consent tracking
│   ├── conversations/              # Conversation inbox / threading
│   ├── templates/                  # Message template management
│   ├── campaigns/                  # Campaign execution + scheduler
│   ├── media/                      # Media asset upload / management
│   ├── notifications/              # User notifications
│   ├── billing/                    # Usage tracking
│   ├── analytics/                  # Dashboard analytics
│   ├── settings/                   # System settings + user preferences
│   ├── api-keys/                   # API key management
│   └── webhook-events/             # Webhook event storage
├── app.module.ts                   # Root module
└── main.ts                         # Bootstrap
prisma/
└── schema.prisma                   # Database schema (15+ models)
docs/                               # Comprehensive documentation
test/                               # E2E integration tests
Dockerfile                          # Multi-stage production build
docker-compose.yml                  # Full-stack deployment
```

## API Response Format

### Success Response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": { ... },
  "requestId": "uuid",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Paginated Response

```json
{
  "success": true,
  "statusCode": 200,
  "message": "Success",
  "data": [ ... ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "requestId": "uuid",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Error Response

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request",
  "errorCode": "VALIDATION_ERROR",
  "details": [ ... ],
  "requestId": "uuid",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "path": "/api/v1/users"
}
```

## Authentication Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/v1/auth/register` | Register new user | Public |
| POST | `/api/v1/auth/login` | Login | Public |
| POST | `/api/v1/auth/logout` | Logout | Bearer |
| POST | `/api/v1/auth/refresh` | Refresh tokens | Public |
| POST | `/api/v1/auth/change-password` | Change password | Bearer |
| POST | `/api/v1/auth/forgot-password` | Request password reset | Public |
| POST | `/api/v1/auth/reset-password` | Reset password | Public |
| POST | `/api/v1/auth/verify-email` | Verify email | Public |
| GET  | `/api/v1/auth/sessions` | List active sessions | Bearer |
| DELETE | `/api/v1/auth/sessions/:id` | Revoke session | Bearer |
| GET  | `/api/v1/auth/me` | Get current user | Bearer |

## Messaging API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/messaging/providers` | Create messaging provider (Admin) |
| POST | `/api/v1/messaging/providers/:id/configure` | Configure provider credentials |
| POST | `/api/v1/messaging/send` | Send a message |
| GET | `/api/v1/contacts` | List contacts |
| POST | `/api/v1/contacts` | Create contact |
| POST | `/api/v1/contacts/import` | Bulk import contacts |
| PATCH | `/api/v1/contacts/:id/opt-in` | Opt-in contact |
| GET | `/api/v1/conversations` | List conversations |
| GET | `/api/v1/conversations/:id/messages` | Get conversation messages |
| POST | `/api/v1/templates` | Create message template |
| POST | `/api/v1/campaigns` | Create campaign |
| POST | `/api/v1/campaigns/:id/recipients` | Add campaign recipients |
| POST | `/api/v1/campaigns/:id/start` | Start campaign execution |
| POST | `/api/v1/media/upload` | Upload media file |
| POST | `/api/v1/api-keys` | Generate API key |
| GET | `/api/v1/analytics/dashboard` | Analytics summary |
| GET | `/api/v1/billing/summary` | Billing usage |
| GET/POST | `/api/v1/messaging/webhooks/:provider` | Webhook verify/process |

See [docs/API_REFERENCE.md](docs/API_REFERENCE.md) for complete endpoint documentation with request/response examples.

## Generate Resources

```bash
# Generate a new CRUD resource
npm run generate:resource -- Product

# This creates:
# src/modules/products/
# ├── dto/
# │   ├── create-product.dto.ts
# │   ├── update-product.dto.ts
# │   └── index.ts
# ├── products.controller.ts
# ├── products.service.ts
# ├── products.module.ts
# └── products.service.spec.ts
```

## Docker

```bash
# Development (databases only)
npm run docker:dev

# Production (full stack)
npm run docker:up

# Build production image
npm run docker:build
```

## Configuration

All configuration is managed via environment variables with type-safe config modules. See `.env.example` for all available options.

| Module | Toggle | Description |
|--------|--------|-------------|
| Redis | `REDIS_ENABLED` | Enable/disable Redis cache |
| Mail | `MAIL_ENABLED` | Enable/disable email sending |
| Queue | `QUEUE_ENABLED` | Enable/disable BullMQ queues |
| Email Verification | `EMAIL_VERIFICATION_ENABLED` | Require email verification |

## Security

- **Helmet** - HTTP security headers
- **CORS** - Configurable cross-origin policy
- **Rate Limiting** - Throttler-based request limiting
- **Password Hashing** - bcrypt with configurable rounds
- **JWT** - Short-lived access tokens + refresh token rotation
- **Input Validation** - class-validator with whitelist mode
- **Soft Deletes** - Data preservation
- **Sensitive Data Redaction** - Passwords, tokens removed from logs
- **Account Locking** - Auto-lock after failed login attempts

## Scripts

| Script | Description |
|--------|-------------|
| `npm run start:dev` | Start in development mode |
| `npm run build` | Build for production |
| `npm run start:prod` | Start production build |
| `npm run lint` | Run ESLint |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run E2E tests |
| `npm run test:cov` | Run tests with coverage |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:migrate` | Run database migrations |
| `npm run prisma:push` | Push schema to database |
| `npm run prisma:studio` | Open Prisma Studio |
| `npm run docker:dev` | Start dev databases |
| `npm run docker:up` | Start production stack |
| `npm run generate:resource` | Generate new resource |

## Documentation

| Document | Description |
|----------|-------------|
| [API Reference](docs/API_REFERENCE.md) | Complete endpoint guide with request/response examples |
| [Developer Guide](docs/DEVELOPER_GUIDE.md) | Setup, development workflow, extending the platform |
| [Architecture](docs/ARCHITECTURE.md) | System architecture, message flow, module dependencies |
| [Messaging Platform](docs/MESSAGING.md) | Provider system, queues, encryption, campaigns, media, events |
| [Webhooks](docs/WEBHOOKS.md) | Webhook setup, verification, processing, testing |
| [Deployment](docs/DEPLOYMENT.md) | Docker, manual deploy, CI/CD, scaling, monitoring |
| [Security](docs/SECURITY.md) | Auth, RBAC, encryption, webhook security, audit |
| [Authentication](docs/AUTH.md) | JWT flow, refresh tokens, sessions, guards |
| [Caching](docs/CACHE.md) | Redis cache configuration and usage |
| [Logging](docs/LOGGING.md) | Structured logging, audit events |
| [DTOs](docs/DTO.md) | Data validation patterns |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Common issues and solutions |

## License

UNLICENSED
