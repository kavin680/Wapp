# Wapp Messaging Platform — Architecture & API Guide

## Overview

The messaging platform is a production-grade, multi-channel communication infrastructure built on top of the enterprise NestJS backend. It supports WhatsApp Cloud API as the primary provider and is architected for extensibility to SMS, Email, Telegram, Messenger, Slack, and more.

## Architecture

### Provider / Plugin System

The platform uses a **provider registry** pattern that decouples message handling from specific channel implementations.

```
IMessagingProvider (interface)
├── WhatsAppProvider (implemented)
├── SMSProvider (future)
├── EmailProvider (future)
├── TelegramProvider (future)
└── ...
```

**Key components:**

- `IMessagingProvider` — interface contract for all providers
- `ProviderRegistryService` — runtime registry of active providers
- `WhatsAppProvider` — full WhatsApp Cloud API implementation
- `MessagingModule` — auto-registers providers on startup via `OnModuleInit`

### Database Models

| Model | Purpose |
|-------|---------|
| `MessagingProvider` | Supported channel types (WhatsApp, SMS, etc.) |
| `ProviderConfig` | Per-user provider credentials and settings |
| `Contact` | Contact records with opt-in/consent tracking |
| `Conversation` | Threaded conversation containers |
| `Message` | Individual messages (inbound/outbound) |
| `MessageStatus` | Delivery status tracking trail |
| `Template` | Message templates with approval workflow |
| `Campaign` | Bulk messaging campaigns |
| `CampaignRecipient` | Per-recipient campaign status |
| `MediaAsset` | Media file references |
| `WebhookEvent` | Raw webhook event storage |
| `BillingUsage` | Usage metering records |
| `UserPreference` | User-level settings |
| `SystemSetting` | System-wide configuration |
| `ApiKey` | API key management |

## Modules

### 1. Messaging (`/messaging`)

Core messaging module handling providers, configuration, message sending, and webhooks.

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/messaging/providers` | List providers |
| GET | `/messaging/providers/:id` | Get provider |
| POST | `/messaging/providers` | Create provider (Admin) |
| PUT | `/messaging/providers/:id` | Update provider (Admin) |
| DELETE | `/messaging/providers/:id` | Delete provider (Super Admin) |
| POST | `/messaging/providers/:id/configure` | Configure provider for user |
| GET | `/messaging/providers/:id/config` | Get user's provider config |
| GET | `/messaging/my-providers` | List user's configured providers |
| POST | `/messaging/send` | Send a message |
| GET | `/messaging/webhooks/:provider` | Verify webhook (public) |
| POST | `/messaging/webhooks/:provider` | Process incoming webhook (public) |

### 2. Contacts (`/contacts`)

Contact management with opt-in/consent tracking and bulk import.

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/contacts` | List contacts (paginated, searchable) |
| GET | `/contacts/:id` | Get contact details |
| POST | `/contacts` | Create contact |
| PUT | `/contacts/:id` | Update contact |
| DELETE | `/contacts/:id` | Soft delete contact |
| POST | `/contacts/import` | Bulk import contacts |
| PATCH | `/contacts/:id/opt-in` | Mark opted in |
| PATCH | `/contacts/:id/opt-out` | Mark opted out |

### 3. Conversations (`/conversations`)

Inbox-style conversation management.

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/conversations` | List conversations (filterable) |
| GET | `/conversations/:id` | Get conversation |
| GET | `/conversations/:id/messages` | Get conversation messages |
| PATCH | `/conversations/:id/close` | Close conversation |
| PATCH | `/conversations/:id/reopen` | Reopen conversation |
| PATCH | `/conversations/:id/archive` | Archive conversation |
| PATCH | `/conversations/:id/read` | Mark as read |
| PATCH | `/conversations/:id/assign` | Assign to user |

### 4. Templates (`/templates`)

Message template management with provider approval workflow.

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/templates` | List templates |
| GET | `/templates/:id` | Get template |
| POST | `/templates` | Create template (Admin) |
| PUT | `/templates/:id` | Update template (Admin) |
| DELETE | `/templates/:id` | Delete template (Admin) |
| PATCH | `/templates/:id/submit` | Submit for approval (Admin) |

### 5. Campaigns (`/campaigns`)

Bulk messaging campaigns with scheduling, batch processing, and real-time stats.

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/campaigns` | List campaigns |
| GET | `/campaigns/:id` | Get campaign |
| POST | `/campaigns` | Create campaign |
| PUT | `/campaigns/:id` | Update campaign |
| DELETE | `/campaigns/:id` | Delete campaign |
| POST | `/campaigns/:id/recipients` | Add recipients |
| GET | `/campaigns/:id/recipients` | Get recipients |
| PATCH | `/campaigns/:id/start` | Start campaign |
| PATCH | `/campaigns/:id/pause` | Pause campaign |
| PATCH | `/campaigns/:id/cancel` | Cancel campaign |
| GET | `/campaigns/:id/stats` | Get campaign stats |

### 6. Billing (`/billing`)

Usage tracking and billing-ready metering.

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/billing/usage` | Get usage records |
| GET | `/billing/summary` | Get billing summary |
| GET | `/billing/by-channel` | Usage breakdown by channel |

### 7. Analytics (`/analytics`)

Comprehensive reporting and dashboards.

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics/dashboard` | Full dashboard data |
| GET | `/analytics/messages` | Message analytics |
| GET | `/analytics/volume` | Message volume over time |
| GET | `/analytics/provider-health` | Provider health status |
| GET | `/analytics/contacts` | Contact statistics |

### 8. Settings (`/settings`)

System settings and user preferences.

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/settings/system` | List system settings (Admin) |
| GET | `/settings/system/public` | List public settings |
| GET | `/settings/system/:category/:key` | Get setting (Admin) |
| POST | `/settings/system` | Create setting (Super Admin) |
| PUT | `/settings/system/:category/:key` | Update setting (Super Admin) |
| DELETE | `/settings/system/:category/:key` | Delete setting (Super Admin) |
| GET | `/settings/preferences` | Get user preferences |
| GET | `/settings/preferences/:key` | Get preference |
| POST | `/settings/preferences` | Set preference |
| DELETE | `/settings/preferences/:key` | Delete preference |

### 9. API Keys (`/api-keys`)

API key management with scoped permissions.

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api-keys` | List API keys (masked) |
| POST | `/api-keys` | Create API key |
| PATCH | `/api-keys/:id/revoke` | Revoke API key |
| DELETE | `/api-keys/:id` | Delete API key |

### 10. Webhook Events (`/webhook-events`)

Webhook event monitoring and reprocessing (Admin).

**Endpoints:**

| Method | Path | Description |
|--------|------|-------------|
| GET | `/webhook-events` | List events |
| GET | `/webhook-events/stats` | Event statistics |
| GET | `/webhook-events/:id` | Get event details |
| PATCH | `/webhook-events/:id/reprocess` | Reprocess event |

## WhatsApp Integration

### Configuration

Set the following environment variables:

```env
WHATSAPP_API_URL=https://graph.facebook.com/v21.0
WHATSAPP_API_TOKEN=your_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_verify_token
WHATSAPP_APP_SECRET=your_app_secret
```

### Supported Message Types

- Text
- Image
- Video
- Audio
- Document
- Location
- Interactive (buttons/lists)
- Reaction
- Sticker
- Template (with variable substitution)

### Webhook Setup

1. Configure your webhook URL: `https://your-domain.com/messaging/webhooks/WHATSAPP`
2. Set the verify token matching `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
3. Subscribe to: `messages`, `messaging_postbacks`

## Security

- **RBAC**: Role-based access control via `@Roles()` decorator
- **Permissions**: Granular messaging permissions (send, read, manage providers, etc.)
- **API Keys**: Scoped API keys with expiration
- **Webhook Verification**: Token-based verification for incoming webhooks
- **Credential Encryption**: Provider credentials encrypted at rest with AES-256-GCM
- **Audit Logging**: All messaging actions tracked via audit system
- **Consent Tracking**: Contact opt-in/opt-out status management

## Adding a New Provider

1. Create a new provider class implementing `IMessagingProvider`:

```typescript
@Injectable()
export class SMSProvider implements IMessagingProvider {
  readonly providerType = 'SMS';
  
  async sendMessage(payload: SendMessagePayload): Promise<SendMessageResult> {
    // Implementation
  }
  // ... implement all interface methods
}
```

2. Register in `MessagingModule`:

```typescript
@Module({
  providers: [SMSProvider],
})
export class MessagingModule implements OnModuleInit {
  constructor(
    private readonly registry: ProviderRegistryService,
    private readonly smsProvider: SMSProvider,
  ) {}

  onModuleInit() {
    this.registry.register(this.smsProvider);
  }
}
```

3. Add the provider type to the Prisma `ProviderType` enum.

---

## Queue-Based Message Sending

Messages can be sent asynchronously via BullMQ when `QUEUE_ENABLED=true`.

### How it works

```
POST /messaging/send
      │
      ├─ QUEUE_ENABLED=true  → Creates job in MESSAGE_QUEUE → Redis → MessageProcessor picks it up
      │                                                                      │
      │                                                                      ├─ Calls provider.sendMessage()
      │                                                                      ├─ Updates message record in DB
      │                                                                      └─ Emits 'message.processed' event
      │
      └─ QUEUE_ENABLED=false → Calls sendMessageSync() directly (legacy/dev mode)
```

### Configuration

| Variable | Default | Description |
|---|---|---|
| `QUEUE_ENABLED` | `false` | Enable queue-based sending |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `messaging.retry.maxAttempts` | `3` | Max retry attempts per message |
| `messaging.retry.backoffMs` | `1000` | Base backoff delay in ms |

### Retry Strategy

Failed messages are retried with **exponential backoff**:
- Attempt 1: immediate
- Attempt 2: 1s delay
- Attempt 3: 2s delay
- Attempt 4: 4s delay
- ... up to `maxAttempts`

BullMQ manages retries automatically. Failed jobs move to the failed queue for inspection.

---

## Campaign Scheduler

Scheduled campaigns execute automatically via a polling-based scheduler.

### Flow

1. Create a campaign with `scheduledAt` in the future
2. `CampaignSchedulerService` polls every 60s (configurable via `CAMPAIGN_SCHEDULER_INTERVAL_MS`)
3. When `scheduledAt <= now` and `status = SCHEDULED`, the campaign starts
4. `CampaignProcessor` batches recipients and enqueues individual messages to `MESSAGE_QUEUE`
5. Campaign status transitions: `DRAFT → SCHEDULED → IN_PROGRESS → COMPLETED`

### Pause / Cancel

- `POST /campaigns/:id/pause` — pauses mid-execution (processor checks status each batch)
- `POST /campaigns/:id/cancel` — cancels remaining sends

---

## Provider Credential Encryption

Provider credentials are encrypted at rest using **AES-256-GCM**.

### Format

```
iv_hex:auth_tag_hex:ciphertext_hex
```

- **IV**: 16 random bytes (unique per encryption)
- **Auth Tag**: 16 bytes for integrity verification
- **Key derivation**: SHA-256 hash of `ENCRYPTION_KEY` env var

### Usage

```typescript
// Automatic — when configuring a provider:
POST /messaging/providers/:id/configure
{
  "credentials": { "apiToken": "secret-token" }
}
// credentials are encrypted before DB storage

// Reading — decrypted on retrieval:
GET /messaging/providers/:id/config
// credentials returned as plain JSON
```

Set `ENCRYPTION_KEY` in production (minimum 32 characters recommended).

---

## Media Asset Management

Upload and manage media files for messages.

### Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/media/upload` | Upload file (multipart/form-data) |
| `GET` | `/media` | List all media assets |
| `GET` | `/media/:id` | Get single asset |
| `GET` | `/media/message/:messageId` | Get media for a message |
| `DELETE` | `/media/:id` | Delete asset |

### Upload Example

```bash
curl -X POST http://localhost:3000/api/v1/media/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@image.png" \
  -F "type=IMAGE" \
  -F "messageId=<optional-message-id>"
```

Supported types: `IMAGE`, `VIDEO`, `AUDIO`, `DOCUMENT`, `STICKER`

---

## Event-Driven Notifications

The system emits events on key messaging actions. Event listeners create user notifications automatically.

### Events

| Event | Trigger | Notification Created |
|---|---|---|
| `message.processed` | After message send attempt | Yes, if send failed |
| `campaign.completed` | Campaign finishes all sends | Yes |
| `campaign.failed` | Campaign encounters error | Yes |
| `message.incoming` | Webhook delivers inbound message | Yes |

### Architecture

```
MessagingService / Processors
        │
        └─ EventEmitter2.emit('message.processed', payload)
                │
                └─ MessagingEventsListener (@OnEvent)
                        │
                        └─ NotificationsService.create(notification)
```

---

## Rate Limiting

Messaging endpoints are rate-limited using `@nestjs/throttler`.

- **Default**: 100 requests per 60 seconds per user
- Applied globally; messaging send endpoints inherit the global config
- Returns `429 Too Many Requests` when exceeded

---

## Deployment

### Docker (Recommended)

```bash
# Copy and configure environment
cp .env.example .env
# Edit .env with production values

# Start all services
docker compose up -d

# Run database migrations
docker compose exec api npx prisma db push

# Seed initial data
docker compose exec api npx ts-node src/database/seeds/seed.ts
```

### Manual

```bash
# Prerequisites: Node.js 20+, PostgreSQL 15+, Redis 7+

npm ci
npx prisma generate
npx prisma db push
npx ts-node src/database/seeds/seed.ts
npm run build
npm run start:prod
```

### Environment Variables

See `.env.example` for the full list. Critical production variables:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | JWT signing secret |
| `JWT_REFRESH_SECRET` | Yes | Refresh token secret |
| `ENCRYPTION_KEY` | Yes | AES-256 key for credential encryption |
| `REDIS_HOST` | For queues | Redis host |
| `QUEUE_ENABLED` | No | Enable async message sending |

---

## Scaling Considerations

### Horizontal Scaling

- **API servers**: Stateless — scale behind a load balancer
- **Queue workers**: Run additional `MessageProcessor` / `CampaignProcessor` instances connected to the same Redis
- **Database**: Use connection pooling (PgBouncer) and read replicas for analytics queries

### Vertical Scaling

- Campaign batch size is configurable — larger batches = higher throughput
- Redis can handle millions of queued jobs
- PostgreSQL indexes on `Message.conversationId`, `Campaign.status`, `Contact.userId_phoneNumber`

### Monitoring

- `GET /health` — full health check (DB + Redis connectivity)
- `GET /health/ping` — lightweight liveness probe
- BullMQ Dashboard: integrate Bull Board or Arena for queue monitoring
- Structured JSON logging via Pino (production-ready)

---

## Testing

### Unit Tests

```bash
npm run test          # Run all unit tests
npm run test:cov      # With coverage report
```

5 test suites, 47+ tests covering:
- WhatsApp provider (send, template, webhook verification, webhook processing)
- Provider registry (register, get, has, getAll)
- Encryption service (encrypt/decrypt round-trip, JSON, isEncrypted)
- Contacts service (CRUD, opt-in, import)
- Campaigns service (CRUD, state transitions, stats)

### E2E Tests

```bash
# Requires PostgreSQL and Redis running
npm run test:e2e
```

55+ tests covering full API flows:
- Authentication (register, login, JWT)
- Provider CRUD and configuration
- Contact management with consent tracking
- Template management
- Message sending (graceful failure handling)
- Conversation auto-creation
- Campaign lifecycle (create, recipients, execute)
- API key generation with scopes
- System settings and user preferences
- Analytics dashboard and billing
- RBAC enforcement (403 for unauthorized roles)

### CI/CD

GitHub Actions runs on every push to `main` and on PRs:
1. **Lint & Build** — ESLint + TypeScript compilation
2. **Unit Tests** — Jest unit test suite
3. **E2E Tests** — Full integration tests with PostgreSQL and Redis services

---

## Webhook Processing

### WhatsApp Webhook Setup

1. Configure provider with `phoneNumberId` and `businessAccountId`
2. Use the generated `webhookSecret` for Meta webhook verification
3. Set webhook URL: `https://your-domain.com/api/v1/messaging/webhook/whatsapp`

### Webhook Flow

```
Meta sends POST /messaging/webhook/whatsapp
      │
      ├─ Verify signature (X-Hub-Signature-256)
      ├─ Extract messages and statuses
      ├─ Store WebhookEvent record
      ├─ Process incoming messages → create/update Conversation
      ├─ Process status updates → update MessageStatus
      └─ Emit 'message.incoming' event → Notification created
```

### Verification

```
GET /messaging/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<challenge>
```

Returns the challenge value if token matches, enabling the webhook.
