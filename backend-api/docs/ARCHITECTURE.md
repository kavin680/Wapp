# Architecture Guide

## Overview

Wapp is built as a modular, layered NestJS application with a plugin-based provider architecture for multi-channel messaging.

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         API Gateway                                  │
│         Rate Limiting → Auth → RBAC → Validation                    │
├──────────────┬──────────────┬──────────────┬────────────────────────┤
│   Messaging  │   Contacts   │  Campaigns   │   Analytics/Billing    │
│   Module     │   Module     │  Module      │   Module               │
├──────────────┴──────────────┴──────────────┴────────────────────────┤
│                    Provider Registry                                 │
│         WhatsApp │ SMS (future) │ Email (future) │ ...              │
├──────────────────────────────────────────────────────────────────────┤
│                    Queue Layer (BullMQ + Redis)                      │
│         MESSAGE_QUEUE              │           CAMPAIGN_QUEUE        │
│         MessageProcessor           │           CampaignProcessor     │
├──────────────────────────────────────────────────────────────────────┤
│                    Event System (EventEmitter2)                      │
│    message.processed │ campaign.completed │ message.incoming         │
├──────────────────────────────────────────────────────────────────────┤
│                    Data Layer (Prisma + PostgreSQL)                  │
│    15+ models │ Soft deletes │ Audit fields │ JSON credentials       │
├──────────────────────────────────────────────────────────────────────┤
│                    Infrastructure                                    │
│    EncryptionService │ StorageService │ CacheManager │ Logger        │
└──────────────────────────────────────────────────────────────────────┘
```

## Architecture Layers

```
┌─────────────────────────────────────────┐
│            API Layer (Controllers)       │
│  Routes, Swagger, Request Validation     │
├─────────────────────────────────────────┤
│         Business Logic (Services)        │
│  Domain Logic, Data Transformation       │
├─────────────────────────────────────────┤
│          Queue Layer (BullMQ)            │
│  Async Processing, Retry, Batch Jobs     │
├─────────────────────────────────────────┤
│          Data Access (Prisma)            │
│  Database Queries, Transactions          │
├─────────────────────────────────────────┤
│        Infrastructure Layer              │
│  Config, Logging, Cache, Mail, Queue     │
├─────────────────────────────────────────┤
│        Security Layer                    │
│  Encryption, Guards, Filters, RBAC       │
├─────────────────────────────────────────┤
│          Common Layer                    │
│  Interceptors, Decorators, DTOs, Utils   │
└─────────────────────────────────────────┘
```

## Request Lifecycle

1. **Request arrives** → RequestIdMiddleware assigns unique ID
2. **Rate limiting** → ThrottlerGuard checks per-IP/user limits
3. **Authentication** → JwtAuthGuard validates token (unless `@Public`)
4. **Authorization** → RolesGuard checks role, PermissionsGuard checks permissions
5. **Validation** → ValidationPipe validates request body (whitelist + forbidNonWhitelisted)
6. **Logging** → LoggingInterceptor logs request details
7. **Controller** → Routes to handler
8. **Service** → Executes business logic
9. **Queue (optional)** → Enqueues to BullMQ for async processing
10. **Database** → Prisma performs data operations
11. **Response** → ResponseInterceptor wraps in standard format
12. **Audit** → AuditInterceptor logs changes (if `@Audit` decorator)
13. **Events** → EventEmitter2 emits domain events → listeners create notifications

## Message Sending Flow

```
Client → POST /messaging/send
            │
            ├── Validate DTO (to, type, content, providerId)
            ├── Lookup ProviderConfig → decrypt credentials
            ├── Find/create Contact
            ├── Find/create Conversation
            ├── Create Message record (status: PENDING)
            │
            ├── QUEUE_ENABLED=true?
            │     ├── YES → Enqueue to MESSAGE_QUEUE → return {queued: true}
            │     │            │
            │     │            └── MessageProcessor (async):
            │     │                  ├── Configure provider with decrypted credentials
            │     │                  ├── Call provider.sendMessage()
            │     │                  ├── Update message status (SENT/FAILED)
            │     │                  ├── Create BillingUsage record
            │     │                  └── Emit 'message.processed' event
            │     │
            │     └── NO → Call sendMessageSync() directly
            │                  ├── Same as MessageProcessor logic
            │                  └── Return result immediately
            │
            └── Return response with message + conversation
```

## Campaign Execution Flow

```
1. Create Campaign (status: DRAFT)
2. Add Recipients (contactIds)
3. Schedule or Start:
   ├── POST /campaigns/:id/start → status: IN_PROGRESS
   └── Set scheduledAt → status: SCHEDULED
        └── CampaignSchedulerService polls every 60s
             └── When scheduledAt <= now → calls campaignsService.start()

4. Execution:
   └── CampaignProcessor:
        ├── Load recipients in batches
        ├── For each recipient:
        │     ├── Check campaign status (handle pause/cancel)
        │     ├── Create Message record
        │     └── Enqueue to MESSAGE_QUEUE
        ├── Update campaign stats (sentCount, failedCount)
        └── Emit 'campaign.completed' event
```

## Credential Encryption Flow

```
Configure Provider:
   Client sends { credentials: { apiToken: "secret" } }
      │
      └── EncryptionService.encryptJson(credentials)
            ├── JSON.stringify(credentials)
            ├── Generate random 16-byte IV
            ├── AES-256-GCM encrypt
            ├── Store: "iv_hex:tag_hex:ciphertext_hex"
            └── Save encrypted string to ProviderConfig.credentials

Read Provider Config:
   GET /providers/:id/config
      │
      └── EncryptionService.decryptJson(encrypted)
            ├── Split by ':'
            ├── AES-256-GCM decrypt
            ├── JSON.parse(plaintext)
            └── Return { apiToken: "secret" }
```

## Module Dependencies

```
AppModule
├── DatabaseModule (global)
├── CommonModule (EncryptionService, StorageService)
├── AuthModule
├── UsersModule
├── HealthModule
├── AuditModule
├── MessagingModule
│     ├── BullModule (MESSAGE_QUEUE, CAMPAIGN_QUEUE)
│     ├── NotificationsModule
│     ├── MessageProcessor
│     ├── CampaignProcessor
│     └── MessagingEventsListener
├── ContactsModule
├── ConversationsModule
├── TemplatesModule
├── CampaignsModule
│     └── CampaignSchedulerService
├── MediaModule
├── NotificationsModule
├── BillingModule
├── AnalyticsModule
├── SettingsModule
├── ApiKeysModule
└── WebhookEventsModule
```

## Design Patterns

| Pattern | Usage |
|---------|-------|
| **Plugin/Registry** | Provider system — register providers at startup, lookup by type |
| **Repository** | PrismaService as the data access layer |
| **Strategy** | Passport strategies for auth, provider implementations for messaging |
| **Observer/Event** | EventEmitter2 for domain events → notification creation |
| **Queue/Worker** | BullMQ for async message processing with retry |
| **Decorator** | Custom decorators for auth, audit, roles, permissions |
| **Interceptor** | Cross-cutting concerns (logging, response wrapping, audit) |
| **Guard** | Authentication and authorization |
| **Filter** | Global exception handling |
| **Scheduler** | CampaignSchedulerService for timed campaign execution |

## Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `create-user.dto.ts` |
| Classes | PascalCase | `CreateUserDto` |
| Methods | camelCase | `findAll()` |
| Constants | UPPER_SNAKE_CASE | `MESSAGE_QUEUE` |
| Enums | PascalCase | `Role.ADMIN` |
| Decorators | PascalCase | `@CurrentUser()` |
| Config keys | dot notation | `messaging.retry.maxAttempts` |
| DB columns | snake_case | `created_at` |

## Expansion Guide

To add a new module:

1. Run `npm run generate:resource -- ModuleName`
2. Add the Prisma model to `prisma/schema.prisma`
3. Run `npx prisma db push`
4. Import the module in `app.module.ts`
5. Add Swagger tags in `main.ts`

To add a new messaging provider:
1. Implement `IMessagingProvider` interface
2. Register in `MessagingModule.onModuleInit()`
3. Add provider type to Prisma `ProviderType` enum

See [DEVELOPER_GUIDE.md](./DEVELOPER_GUIDE.md) for detailed instructions.
