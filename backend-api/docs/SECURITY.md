# Security Guide

## Security Architecture

```
┌──────────────────────────────────────────────┐
│              Transport Security               │
│    HTTPS/TLS │ Helmet Headers │ CORS          │
├──────────────────────────────────────────────┤
│              Rate Limiting                    │
│    100 req/60s per IP (ThrottlerGuard)        │
├──────────────────────────────────────────────┤
│              Authentication                   │
│    JWT Access Token │ Refresh Token Rotation  │
├──────────────────────────────────────────────┤
│              Authorization                    │
│    RBAC Roles │ Granular Permissions          │
├──────────────────────────────────────────────┤
│              Input Validation                 │
│    Whitelist │ Transform │ ForbidUnknown      │
├──────────────────────────────────────────────┤
│              Data Protection                  │
│    AES-256-GCM │ bcrypt │ Log Redaction       │
├──────────────────────────────────────────────┤
│              Audit & Monitoring               │
│    Action Logging │ Security Events │ Alerts  │
└──────────────────────────────────────────────┘
```

## HTTP Security Headers

Helmet is applied globally, setting secure headers:
- `Content-Security-Policy` — prevents XSS attacks
- `X-Content-Type-Options: nosniff` — prevents MIME sniffing
- `X-Frame-Options: SAMEORIGIN` — prevents clickjacking
- `Strict-Transport-Security` — forces HTTPS
- `X-XSS-Protection` — legacy XSS protection

## CORS

Configurable origins via `CORS_ORIGINS` environment variable:

```env
CORS_ORIGINS=https://app.example.com,https://admin.example.com
```

In production, always restrict from the default `*`.

## Rate Limiting

- **Global**: 100 requests per 60 seconds per IP
- **Auth endpoints**: Configurable separate limits
- **Messaging endpoints**: Subject to global throttling
- Returns `429 Too Many Requests` when exceeded

## Authentication

### JWT Tokens

- **Access Token**: Short-lived (15 min default), contains `sub`, `email`, `role`
- **Refresh Token**: Long-lived (7 days), stored in sessions table
- **Rotation**: Old refresh tokens are revoked on use (prevents replay)

### Password Security

- bcrypt hashing with 12 rounds (configurable via `BCRYPT_SALT_ROUNDS`)
- Complexity requirements: uppercase, lowercase, digit, special character
- Minimum 8 characters

### Account Protection

- Account lockout after 5 failed login attempts
- 30-minute lockout duration
- Login attempt tracking with timestamps

## Authorization (RBAC)

### Roles

| Role | Description |
|------|-------------|
| `SUPER_ADMIN` | Full platform access |
| `ADMIN` | Administrative access (manage providers, campaigns, settings) |
| `USER` | Standard user (send messages, manage own contacts) |

### Permissions

Granular permissions applied via `@Permissions()` decorator:

| Permission | Description |
|-----------|-------------|
| `messaging:send` | Send messages |
| `messaging:read` | Read messages/conversations |
| `messaging:manage_providers` | Create/configure providers |
| `contacts:read` | View contacts |
| `contacts:write` | Create/edit contacts |
| `campaigns:manage` | Create/manage campaigns |
| `analytics:read` | View analytics dashboard |
| `settings:manage` | Manage system settings |
| `users:manage` | Manage users |
| `billing:read` | View billing data |

## Provider Credential Encryption

### How It Works

Provider credentials (API tokens, secrets) are encrypted at rest using **AES-256-GCM**:

```
Plaintext credentials → AES-256-GCM encrypt → Store in database
Database value → AES-256-GCM decrypt → Return to authorized user
```

### Encryption Details

| Property | Value |
|----------|-------|
| Algorithm | AES-256-GCM |
| Key size | 256 bits (32 bytes) |
| IV | 16 random bytes (unique per encryption) |
| Auth tag | 16 bytes (integrity verification) |
| Storage format | `iv_hex:tag_hex:ciphertext_hex` |
| Key derivation | SHA-256 hash of `ENCRYPTION_KEY` env var |

### Key Management

```bash
# Generate a strong encryption key
openssl rand -hex 32

# Set in environment
ENCRYPTION_KEY=your-64-char-hex-key-here
```

**Important:**
- Never commit `ENCRYPTION_KEY` to source control
- Rotate the key by re-encrypting all provider configs
- Store the key in a secrets manager (AWS Secrets Manager, Vault, etc.)
- If the key is lost, all encrypted credentials must be re-entered

### What Gets Encrypted

| Data | Encryption | Storage |
|------|-----------|---------|
| Provider API tokens | AES-256-GCM | `ProviderConfig.credentials` |
| Provider secrets | AES-256-GCM | `ProviderConfig.credentials` |
| User passwords | bcrypt (one-way hash) | `User.password` |
| JWT tokens | HMAC-SHA256 signature | Not stored (stateless) |

## Webhook Security

### WhatsApp Webhook Verification

1. **Registration**: Meta sends a GET request with `hub.verify_token`
2. **Validation**: Platform checks token against stored `webhookSecret`
3. **Response**: Returns `hub.challenge` if valid, 403 if not

### Incoming Webhook Authentication

1. Meta signs the request body with HMAC-SHA256 using the app secret
2. Signature is sent in `X-Hub-Signature-256` header
3. Platform verifies the signature before processing

### Webhook Endpoint Protection

- Endpoints are `@Public()` (no JWT required)
- Protected by provider-specific signature verification
- Subject to global rate limiting
- All payloads stored in `WebhookEvent` for audit

## API Key Security

- API keys are hashed before storage (raw key only returned at creation)
- Scoped with specific permissions (e.g., `messaging:send`)
- Support expiration dates
- Can be revoked at any time

## Audit Logging

All security-relevant actions are tracked:

| Event Type | Examples |
|-----------|----------|
| Authentication | Login, logout, failed login, password change |
| Authorization | Role changes, permission updates |
| Data Access | Provider config read, credential decryption |
| Messaging | Message sent, campaign started |
| Admin | User management, system settings changes |

Query audit logs:
```http
GET /api/v1/audit?action=LOGIN&page=1&limit=20
Authorization: Bearer <admin-token>
```

## Data Protection

- **Soft deletes**: Records are marked deleted, not removed (data preservation)
- **Sensitive data redaction**: Passwords, tokens, credentials removed from logs
- **Production mode**: Error stack traces suppressed in API responses
- **Input validation**: Whitelist mode rejects unexpected properties
- **SQL injection**: Prevented by Prisma ORM (parameterized queries)

## Security Checklist

### Development
- [ ] Change all default secrets in `.env`
- [ ] Use different secrets for dev/staging/prod
- [ ] Never log or expose credentials

### Production
- [ ] Set strong JWT secrets (min 32 chars)
- [ ] Set ENCRYPTION_KEY for credential encryption
- [ ] Enable HTTPS/TLS termination
- [ ] Restrict CORS origins (remove `*`)
- [ ] Configure rate limiting thresholds
- [ ] Enable email verification (`EMAIL_VERIFICATION_ENABLED=true`)
- [ ] Set up log monitoring for security events
- [ ] Regular dependency updates (`npm audit`)
- [ ] Database access restricted to application only
- [ ] Store secrets in a secrets manager
- [ ] Enable database connection encryption (SSL)
- [ ] Set up intrusion detection / alerting
