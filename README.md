# Wapp — WhatsApp Messaging Platform

A production-ready backend for sending and receiving WhatsApp messages via the **Meta Cloud API**. Built with NestJS, Prisma, and PostgreSQL.

## Features

| Area | What you get |
|------|-------------|
| **Messaging** | Send text, image, video, audio, document, template, interactive, and reaction messages through the WhatsApp Cloud API |
| **Contacts** | Contact management with opt-in / opt-out consent tracking and bulk import |
| **Conversations** | Inbox-style threaded conversations — open, close, archive, assign to agents |
| **Templates** | Create message templates and submit them for Meta approval directly from the API |
| **Campaigns** | Bulk messaging campaigns with scheduling, batching, rate limiting, and real-time stats |
| **Webhooks** | Receive and verify incoming WhatsApp webhooks (message delivery statuses, inbound messages) |
| **Media** | Upload, store, and attach media assets to messages |
| **Analytics** | Message volume, delivery rates, response times, and campaign performance |
| **Billing** | Usage metering per user (message counts, costs by channel) |
| **Admin UI** | Server-rendered dashboard (Handlebars) for managing the platform without an external frontend |
| **Auth & RBAC** | JWT authentication, refresh tokens, role-based access (USER / ADMIN / SUPER_ADMIN) |
| **API Keys** | Generate scoped API keys for programmatic access |
| **Audit Logging** | Every sensitive action is logged with user, IP, and request context |
| **Queue Processing** | Optional async message sending via BullMQ + Redis |
| **Provider System** | Pluggable provider architecture — WhatsApp is built-in; add SMS, Telegram, etc. |

## Prerequisites

- **Node.js** >= 18
- **PostgreSQL** 15+
- **Redis** 7+ *(optional — only needed if you enable queues)*
- **Docker & Docker Compose** *(recommended for local development)*

## Quick Start

```bash
# 1. Clone and install
cd backend-api
cp .env.example .env          # edit with your WhatsApp credentials
npm install

# 2. Start databases
docker compose up -d postgres redis
# Wait ~10 s for the health checks to pass

# 3. Set up the database
npx prisma db push
npx prisma db seed            # creates admin@enterprise.com / Admin@123456

# 4. Start the server
npm run start:dev
```

The app is now running:

| URL | Description |
|-----|-------------|
| `http://localhost:3000/docs` | Swagger API docs |
| `http://localhost:3000/admin` | Admin dashboard |
| `http://localhost:3000/api/v1/health/ping` | Health check |

## WhatsApp Configuration

You need a **Meta Developer account** with a WhatsApp Business app. Get credentials from [developers.facebook.com](https://developers.facebook.com):

| Env var | Where to find it |
|---------|-----------------|
| `WHATSAPP_API_TOKEN` | API Setup → Temporary or Permanent access token |
| `WHATSAPP_PHONE_NUMBER_ID` | API Setup → Phone Number ID |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | API Setup → WhatsApp Business Account ID |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Any string you choose — enter the same value in Meta's webhook config |
| `WHATSAPP_APP_SECRET` | App Settings → App Secret (verifies webhook signatures) |

### Webhook Setup

1. In your Meta app dashboard, go to **WhatsApp → Configuration → Webhook**
2. Set the callback URL to `https://your-domain.com/api/v1/messaging/webhooks/WHATSAPP`
3. Set the verify token to the same value as `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
4. Subscribe to: `messages`, `message_template_status_update`

## API Overview

All API endpoints use the `/api/v1` prefix. Protected endpoints require a Bearer token from `/api/v1/auth/login`.

### Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | Public | Register a new user |
| POST | `/auth/login` | Public | Login — returns `accessToken` + `refreshToken` |
| GET | `/auth/me` | JWT | Get current user profile |
| POST | `/auth/refresh` | JWT | Refresh the access token |
| POST | `/auth/logout` | JWT | Invalidate sessions |

### Messaging

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/messaging/send` | JWT | Send a message (text, template, media, etc.) |
| GET | `/messaging/providers` | JWT | List available messaging providers |
| POST | `/messaging/providers` | Admin | Create a messaging provider |
| POST | `/messaging/providers/:id/configure` | JWT | Save your WhatsApp credentials for a provider |
| GET | `/messaging/webhooks/:provider` | Public | Webhook verification (GET challenge) |
| POST | `/messaging/webhooks/:provider` | Public | Process incoming webhooks |

### Contacts

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/contacts` | JWT | List contacts (paginated, searchable) |
| POST | `/contacts` | JWT | Create a contact |
| POST | `/contacts/import` | JWT | Bulk import contacts |
| PATCH | `/contacts/:id/opt-in` | JWT | Mark contact as opted in |
| PATCH | `/contacts/:id/opt-out` | JWT | Mark contact as opted out |

### Conversations

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/conversations` | JWT | List conversations (filterable by status, channel) |
| GET | `/conversations/:id/messages` | JWT | Get messages in a conversation |
| PATCH | `/conversations/:id/close` | JWT | Close a conversation |
| PATCH | `/conversations/:id/assign` | JWT | Assign conversation to a user |

### Templates

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/templates` | JWT | List message templates |
| POST | `/templates` | Admin | Create a template |
| PATCH | `/templates/:id/submit` | Admin | Submit template to Meta for approval |

### Campaigns

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/campaigns` | JWT | List campaigns |
| POST | `/campaigns` | JWT | Create a campaign |
| PATCH | `/campaigns/:id/start` | JWT | Start a campaign |
| POST | `/campaigns/:id/recipients` | JWT | Add recipients to a campaign |
| GET | `/campaigns/:id/stats` | JWT | Get campaign statistics |

> For the full endpoint list with request/response schemas, see the [Swagger docs](http://localhost:3000/docs).

## Sending Your First Message

```bash
# 1. Login
TOKEN=$(curl -s http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@enterprise.com","password":"Admin@123456"}' \
  | jq -r '.data.accessToken')

# 2. Send a text message
curl http://localhost:3000/api/v1/messaging/send \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "to": "+1234567890",
    "type": "TEXT",
    "content": { "body": "Hello from Wapp!" }
  }'

# 3. Send a template message
curl http://localhost:3000/api/v1/messaging/send \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "to": "+1234567890",
    "type": "TEMPLATE",
    "content": {},
    "templateName": "hello_world",
    "templateLanguage": "en_US"
  }'
```

## Architecture

```
backend-api/
├── prisma/                  # Database schema & migrations
├── public/                  # Static assets for admin UI
├── views/                   # Handlebars templates for admin UI
├── docs/                    # Detailed documentation
├── src/
│   ├── config/              # Namespaced config (app, auth, database, messaging, ...)
│   ├── database/            # Prisma service & helpers
│   ├── common/              # Shared guards, interceptors, filters, DTOs, utils
│   └── modules/
│       ├── admin/           # Server-rendered admin dashboard
│       ├── analytics/       # Usage analytics & reporting
│       ├── api-keys/        # API key management
│       ├── audit/           # Audit logging
│       ├── auth/            # JWT auth, registration, password reset
│       ├── billing/         # Usage metering
│       ├── cache/           # Optional Redis cache
│       ├── campaigns/       # Bulk messaging campaigns
│       ├── contacts/        # Contact management & consent
│       ├── conversations/   # Conversation inbox
│       ├── feature-flags/   # Feature flag system
│       ├── file-upload/     # File upload & storage
│       ├── health/          # Health checks
│       ├── logger/          # Structured logging (Pino)
│       ├── mail/            # Email sending
│       ├── media/           # Media asset management
│       ├── messaging/       # Core messaging engine
│       │   ├── providers/   # Provider registry + WhatsApp provider
│       │   ├── queues/      # BullMQ message & campaign processors
│       │   └── listeners/   # Event-driven side effects
│       ├── notifications/   # In-app notifications
│       ├── settings/        # System & user preferences
│       ├── templates/       # Message template management
│       ├── users/           # User CRUD
│       ├── webhook-events/  # Raw webhook event storage
│       └── webhooks/        # Outgoing webhook triggers
```

### Provider System

The messaging engine uses a **provider registry** pattern. Each channel (WhatsApp, SMS, etc.) implements the `IMessagingProvider` interface:

```
IMessagingProvider
├── sendMessage()           → Send a message
├── sendTemplateMessage()   → Send a template message
├── createTemplate()        → Create a template on the provider
├── deleteTemplate()        → Delete a template from the provider
├── verifyWebhook()         → Verify incoming webhook challenges
├── processWebhook()        → Parse incoming webhook payloads
└── getMessageStatus()      → Check delivery status
```

The `WhatsAppProvider` is the built-in implementation. To add a new channel:
1. Create a new provider class implementing `IMessagingProvider`
2. Register it in `MessagingModule.onModuleInit()`
3. Add the provider type to the `ProviderType` enum in `schema.prisma`

### Message Flow

```
API Request  →  MessagingService.sendMessage()
                 ├── Find/create Contact
                 ├── Find/create Conversation
                 ├── Create Message record (status: pending)
                 ├── [Queue enabled?]
                 │    ├── Yes → Add to BullMQ → MessageProcessor picks it up
                 │    └── No  → Send synchronously via WhatsAppProvider
                 ├── Update Message with result (sent/failed + externalId)
                 ├── Create MessageStatus record
                 └── Emit 'message.processed' event → Notifications
```

## Test Accounts (Seeded)

| Email | Password | Role |
|-------|----------|------|
| `admin@enterprise.com` | `Admin@123456` | SUPER_ADMIN |
| `user@enterprise.com` | `Admin@123456` | USER |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start in watch mode |
| `npm run build` | Build for production |
| `npm run start:prod` | Start production build |
| `npm run lint` | Lint & auto-fix |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run e2e tests |
| `npm run prisma:studio` | Open Prisma Studio (DB browser) |
| `npm run prisma:migrate` | Create & apply migrations |
| `npm run generate:resource` | Scaffold a new NestJS module |

## Docker Deployment

```bash
# Production deployment with Docker Compose
docker compose up -d

# Or build just the API image
docker build -t wapp-backend .
```

Required env vars for production: `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY`, plus your WhatsApp credentials.

## Documentation

**New to Wapp?** Start with the [Usage Guide](USAGE_GUIDE.md) — a step-by-step walkthrough from setup to sending your first message.

Detailed guides are in the [`docs/`](backend-api/docs/) folder:

| Doc | Topic |
|-----|-------|
| [ARCHITECTURE.md](backend-api/docs/ARCHITECTURE.md) | System architecture & design patterns |
| [AUTH.md](backend-api/docs/AUTH.md) | Authentication & authorization flow |
| [MESSAGING.md](backend-api/docs/MESSAGING.md) | Messaging platform deep-dive |
| [WEBHOOKS.md](backend-api/docs/WEBHOOKS.md) | Webhook setup & processing |
| [API_REFERENCE.md](backend-api/docs/API_REFERENCE.md) | Full API endpoint reference |
| [DEPLOYMENT.md](backend-api/docs/DEPLOYMENT.md) | Deployment guide |
| [SECURITY.md](backend-api/docs/SECURITY.md) | Security practices |
| [TROUBLESHOOTING.md](backend-api/docs/TROUBLESHOOTING.md) | Common issues & solutions |

## License

UNLICENSED — Private project.
