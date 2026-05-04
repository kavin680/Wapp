# Developer Guide

Complete guide for setting up, developing, and extending the Enterprise Messaging Platform.

## Prerequisites

- **Node.js** 20+ (22 recommended)
- **PostgreSQL** 15+
- **Redis** 7+ (optional for dev, required for production queues)
- **Docker & Docker Compose** (recommended for local dev)

## Local Development Setup

### 1. Clone & Install

```bash
git clone <repo-url>
cd Wapp/backend-api
npm install
```

### 2. Environment Configuration

```bash
cp .env.example .env
```

Edit `.env` with your settings. Key variables:

```env
# Required
DATABASE_URL="postgresql://postgres:password@localhost:5432/enterprise_db?schema=public"
JWT_SECRET=your-jwt-secret-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-min-32-chars

# Recommended for production features
ENCRYPTION_KEY=your-encryption-key-min-32-chars
QUEUE_ENABLED=false           # Set to true when Redis is available
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 3. Start Databases

**Option A: Docker (recommended)**
```bash
docker compose up postgres redis -d
```

**Option B: Local services**
```bash
# macOS
brew services start postgresql@15
brew services start redis

# Ubuntu
sudo service postgresql start
sudo service redis-server start
```

### 4. Initialize Database

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed with default users
npx prisma db seed
```

### 5. Start Development Server

```bash
npm run start:dev
```

Server runs at `http://localhost:3000`. Swagger docs at `http://localhost:3000/docs`.

### Default Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Super Admin | admin@enterprise.com | Admin@123456 |
| User | user@enterprise.com | Admin@123456 |

## Project Structure

```
backend-api/
├── src/
│   ├── common/                     # Shared infrastructure
│   │   ├── decorators/             # @Roles, @Public, @CurrentUser, @Audit, @Permissions
│   │   ├── enums/                  # Role, Permission, AuditAction
│   │   ├── filters/               # GlobalExceptionFilter
│   │   ├── guards/                # JwtAuthGuard, RolesGuard, PermissionsGuard
│   │   ├── interceptors/          # ResponseInterceptor, LoggingInterceptor, AuditInterceptor
│   │   └── services/              # EncryptionService, StorageService
│   ├── config/                    # Typed config modules (app, auth, db, redis, messaging)
│   ├── database/                  # PrismaService, seeds
│   └── modules/
│       ├── auth/                  # JWT authentication, sessions, password management
│       ├── users/                 # User CRUD
│       ├── health/                # Health check endpoints
│       ├── audit/                 # Audit log management
│       ├── messaging/             # Core messaging platform
│       │   ├── providers/         # Provider registry + WhatsApp implementation
│       │   ├── queues/            # BullMQ message & campaign processors
│       │   └── listeners/        # Event-driven notification listeners
│       ├── contacts/              # Contact management + consent
│       ├── conversations/         # Conversation inbox/threading
│       ├── templates/             # Message template management
│       ├── campaigns/             # Campaign execution + scheduler
│       ├── media/                 # Media asset upload/management
│       ├── notifications/         # User notifications
│       ├── billing/               # Usage tracking
│       ├── analytics/             # Dashboard analytics
│       ├── settings/              # System settings + user preferences
│       ├── api-keys/              # API key management
│       └── webhook-events/        # Webhook event storage
├── prisma/
│   └── schema.prisma              # Database schema (15+ models)
├── test/
│   └── app.e2e-spec.ts            # E2E integration tests
├── docs/                          # Documentation
├── Dockerfile                     # Multi-stage production build
└── docker-compose.yml             # Full-stack deployment
```

## Creating a New Module

### Using the Resource Generator

```bash
npm run generate:resource -- ModuleName
```

This scaffolds: controller, service, module, DTOs, and spec file.

### Manual Module Creation

1. Create module directory under `src/modules/`:

```typescript
// src/modules/my-feature/my-feature.module.ts
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MyFeatureController } from './my-feature.controller';
import { MyFeatureService } from './my-feature.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MyFeatureController],
  providers: [MyFeatureService],
  exports: [MyFeatureService],
})
export class MyFeatureModule {}
```

2. Add the Prisma model in `prisma/schema.prisma`
3. Run `npx prisma db push`
4. Import the module in `src/app.module.ts`
5. Add Swagger tag in `src/main.ts`

## Adding a New Messaging Provider

The platform uses a plugin architecture. To add a new provider (e.g., Twilio SMS):

### 1. Implement the Provider Interface

```typescript
// src/modules/messaging/providers/sms/sms.provider.ts
import { Injectable, Logger } from '@nestjs/common';
import { IMessagingProvider, SendMessagePayload, SendMessageResult } from '../interfaces';

@Injectable()
export class SMSProvider implements IMessagingProvider {
  readonly providerType = 'SMS';
  private readonly logger = new Logger(SMSProvider.name);
  private config: any;

  async configure(credentials: Record<string, any>, settings?: Record<string, any>): Promise<void> {
    this.config = { ...credentials, ...settings };
  }

  async sendMessage(payload: SendMessagePayload): Promise<SendMessageResult> {
    // Implement Twilio/SMS sending logic
    try {
      const response = await fetch('https://api.twilio.com/...', { ... });
      return { success: true, externalId: response.sid };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async sendTemplateMessage(payload: any): Promise<SendMessageResult> {
    return this.sendMessage(payload); // SMS templates are just text
  }

  async createTemplate(template: any): Promise<any> {
    return template; // SMS doesn't have template approval
  }

  async verifyWebhook(params: Record<string, string>): Promise<string | null> {
    // Implement Twilio webhook verification
    return null;
  }

  async processWebhook(body: any, headers: Record<string, string>): Promise<any> {
    // Extract incoming SMS messages and status updates
    return { messages: [], statuses: [] };
  }
}
```

### 2. Add Provider Type to Schema

```prisma
enum ProviderType {
  WHATSAPP
  SMS       // Add new type
  EMAIL
  TELEGRAM
}
```

### 3. Register in MessagingModule

```typescript
// In messaging.module.ts
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

## Testing

### Unit Tests

```bash
npm run test              # Run all unit tests
npm run test -- --watch   # Watch mode
npm run test:cov          # With coverage report
```

Test files are co-located: `*.service.spec.ts`, `*.provider.spec.ts`

Current test suites:
- `encryption.service.spec.ts` — AES-256-GCM encrypt/decrypt round-trips
- `whatsapp.provider.spec.ts` — Message sending, webhook verification, webhook processing
- `provider-registry.service.spec.ts` — Provider registration and lookup
- `contacts.service.spec.ts` — Contact CRUD, opt-in, bulk import
- `campaigns.service.spec.ts` — Campaign CRUD, state transitions, stats

### E2E Tests

```bash
# Requires PostgreSQL and Redis running
npm run test:e2e
```

E2E tests cover the full API lifecycle:
- Auth flow (register, login, JWT)
- Provider CRUD and configuration
- Contact management with consent tracking
- Template management
- Message sending (graceful failure handling)
- Conversation auto-creation and threading
- Campaign lifecycle (create → recipients → start → stats)
- API key generation with scoped permissions
- Settings and preferences
- Analytics and billing
- RBAC enforcement (USER gets 403 on admin endpoints)

### Writing New Tests

**Unit test pattern:**
```typescript
describe('MyService', () => {
  let service: MyService;
  const mockPrisma = {
    myModel: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        MyService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(MyService);
  });

  it('should create a record', async () => {
    mockPrisma.myModel.create.mockResolvedValue({ id: '1' });
    const result = await service.create({ name: 'test' });
    expect(result.id).toBe('1');
  });
});
```

**E2E test pattern:**
```typescript
it('POST /api/v1/my-resource — creates resource', async () => {
  const res = await request(app.getHttpServer())
    .post('/api/v1/my-resource')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ name: 'test' })
    .expect(201);

  expect(res.body.data.name).toBe('test');
});
```

## Database Management

### Schema Changes

```bash
# After editing prisma/schema.prisma:
npx prisma db push           # Apply changes (dev)
npx prisma migrate dev        # Create migration (when using migrations)
npx prisma generate           # Regenerate client
npx prisma studio             # Visual database browser
```

### Seeding

```bash
npx prisma db seed
```

The seed script (`src/database/seeds/seed.ts`) creates:
- Super Admin user (`admin@enterprise.com` / `Admin@123456`)
- Test User (`user@enterprise.com` / `Admin@123456`)

### Resetting Database

```bash
npx prisma migrate reset      # Drop all tables, re-apply migrations, re-seed
```

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `APP_PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | Environment |
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `JWT_SECRET` | Yes | - | Access token signing secret |
| `JWT_REFRESH_SECRET` | Yes | - | Refresh token signing secret |
| `JWT_EXPIRES_IN` | No | `15m` | Access token lifetime |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token lifetime |
| `BCRYPT_SALT_ROUNDS` | No | `12` | Password hashing rounds |
| `REDIS_ENABLED` | No | `true` | Enable Redis cache |
| `REDIS_HOST` | No | `localhost` | Redis host |
| `REDIS_PORT` | No | `6379` | Redis port |
| `QUEUE_ENABLED` | No | `false` | Enable BullMQ message queues |
| `ENCRYPTION_KEY` | Prod | - | AES-256 key for credential encryption |
| `CAMPAIGN_SCHEDULER_INTERVAL_MS` | No | `60000` | Campaign scheduler poll interval |
| `CORS_ORIGINS` | No | `*` | Allowed CORS origins |
| `EMAIL_VERIFICATION_ENABLED` | No | `false` | Require email verification |
| `MAIL_ENABLED` | No | `false` | Enable email sending |

## Debugging

### Debug Mode

```bash
LOG_LEVEL=debug npm run start:dev     # Verbose logging
npm run start:debug                    # Node.js inspector (attach VS Code)
```

### Common Issues

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) for solutions to common development issues.

## Code Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `create-user.dto.ts` |
| Classes | PascalCase | `CreateUserDto` |
| Methods | camelCase | `findAll()` |
| Constants | UPPER_SNAKE | `MESSAGE_QUEUE` |
| Enums | PascalCase | `Role.ADMIN` |
| Config keys | dot notation | `messaging.retry.maxAttempts` |
