# Enterprise Messaging Platform — Architecture & API Guide

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
- **Credential Storage**: Provider credentials stored as JSON (encrypt at rest recommended)
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
