# API Reference — Complete Endpoint Guide

All endpoints are prefixed with `/api/v1`. Unless marked **Public**, all endpoints require a `Bearer` JWT token.

## Authentication

### Register

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecureP@ss1",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "user": { "id": "uuid", "email": "user@example.com", "role": "USER" },
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "admin@enterprise.com",
  "password": "Admin@123456"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ..."
  }
}
```

### Refresh Token

```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJ..."
}
```

### Change Password

```http
POST /api/v1/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

{
  "currentPassword": "OldP@ss1",
  "newPassword": "NewP@ss2"
}
```

### Get Current User

```http
GET /api/v1/auth/me
Authorization: Bearer <token>
```

### List Active Sessions

```http
GET /api/v1/auth/sessions
Authorization: Bearer <token>
```

### Revoke Session

```http
DELETE /api/v1/auth/sessions/:sessionId
Authorization: Bearer <token>
```

---

## Messaging Providers

### Create Provider (Admin)

```http
POST /api/v1/messaging/providers
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "WhatsApp Cloud API",
  "type": "WHATSAPP",
  "description": "Production WhatsApp provider",
  "isActive": true
}
```

### List Providers

```http
GET /api/v1/messaging/providers
Authorization: Bearer <token>
```

### Configure Provider

```http
POST /api/v1/messaging/providers/:providerId/configure
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "credentials": {
    "apiToken": "EAABx..."
  },
  "settings": {
    "rateLimit": 80
  },
  "phoneNumberId": "1234567890",
  "businessAccountId": "0987654321"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "phoneNumberId": "1234567890",
    "webhookSecret": "whsec_abc123..."
  }
}
```

> **Note:** Credentials are encrypted at rest with AES-256-GCM. The `webhookSecret` is auto-generated for webhook verification.

### Get Provider Configuration

```http
GET /api/v1/messaging/providers/:providerId/config
Authorization: Bearer <token>
```

Returns decrypted credentials and settings.

---

## Send Messages

### Send Text Message

```http
POST /api/v1/messaging/send
Authorization: Bearer <token>
Content-Type: application/json

{
  "to": "+1234567890",
  "type": "TEXT",
  "content": {
    "body": "Hello! This is a test message."
  },
  "providerId": "provider-uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "message": {
      "id": "uuid",
      "direction": "OUTBOUND",
      "status": "SENT",
      "externalId": "wamid.xxx"
    },
    "conversation": {
      "id": "uuid"
    },
    "queued": false
  }
}
```

### Send Image Message

```json
{
  "to": "+1234567890",
  "type": "IMAGE",
  "content": {
    "body": "Check this out!",
    "mediaUrl": "https://example.com/image.jpg"
  },
  "providerId": "provider-uuid"
}
```

### Send Template Message

```json
{
  "to": "+1234567890",
  "type": "TEMPLATE",
  "templateName": "welcome_message",
  "templateLanguage": "en",
  "templateComponents": [
    {
      "type": "body",
      "parameters": [
        { "type": "text", "text": "John" }
      ]
    }
  ],
  "providerId": "provider-uuid"
}
```

### Queue-Based Sending

When `QUEUE_ENABLED=true`, message sends are enqueued to BullMQ and processed asynchronously. The response includes `"queued": true`.

---

## Contacts

### Create Contact

```http
POST /api/v1/contacts
Authorization: Bearer <token>
Content-Type: application/json

{
  "phoneNumber": "+1234567890",
  "firstName": "Jane",
  "lastName": "Doe",
  "email": "jane@example.com",
  "tags": ["vip", "newsletter"],
  "country": "US"
}
```

### List Contacts (Paginated)

```http
GET /api/v1/contacts?page=1&limit=20&search=jane
Authorization: Bearer <token>
```

### Bulk Import

```http
POST /api/v1/contacts/import
Authorization: Bearer <token>
Content-Type: application/json

{
  "contacts": [
    { "phoneNumber": "+111", "firstName": "Alice" },
    { "phoneNumber": "+222", "firstName": "Bob" }
  ]
}
```

**Response:**
```json
{
  "data": { "imported": 2, "skipped": 0, "errors": [] }
}
```

### Opt-In / Opt-Out

```http
PATCH /api/v1/contacts/:id/opt-in
PATCH /api/v1/contacts/:id/opt-out
Authorization: Bearer <token>
```

---

## Conversations

### List Conversations

```http
GET /api/v1/conversations?status=OPEN&page=1&limit=20
Authorization: Bearer <token>
```

### Get Conversation Messages

```http
GET /api/v1/conversations/:id/messages?page=1&limit=50
Authorization: Bearer <token>
```

### Conversation Actions

```http
PATCH /api/v1/conversations/:id/close
PATCH /api/v1/conversations/:id/reopen
PATCH /api/v1/conversations/:id/archive
PATCH /api/v1/conversations/:id/read
PATCH /api/v1/conversations/:id/assign
Authorization: Bearer <token>
```

Assign body: `{ "assignedToId": "user-uuid" }`

---

## Templates

### Create Template (Admin)

```http
POST /api/v1/templates
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "providerId": "provider-uuid",
  "name": "order_confirmation",
  "language": "en",
  "category": "UTILITY",
  "bodyContent": "Hi {{1}}, your order #{{2}} is confirmed.",
  "headerContent": "Order Update",
  "footerContent": "Thank you for shopping with us"
}
```

### Submit for Approval

```http
PATCH /api/v1/templates/:id/submit
Authorization: Bearer <admin-token>
```

---

## Campaigns

### Create Campaign

```http
POST /api/v1/campaigns
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "providerId": "provider-uuid",
  "name": "Black Friday Sale",
  "description": "Promotional campaign",
  "channel": "WHATSAPP",
  "scheduledAt": "2025-11-29T08:00:00Z"
}
```

### Add Recipients

```http
POST /api/v1/campaigns/:id/recipients
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "contactIds": ["contact-uuid-1", "contact-uuid-2"]
}
```

### Campaign Lifecycle

```http
POST /api/v1/campaigns/:id/start     # Start sending
POST /api/v1/campaigns/:id/pause     # Pause mid-execution
POST /api/v1/campaigns/:id/cancel    # Cancel remaining sends
```

### Campaign Stats

```http
GET /api/v1/campaigns/:id/stats
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "data": {
    "total": 1000,
    "sent": 850,
    "delivered": 800,
    "failed": 50,
    "pending": 100
  }
}
```

---

## Media Assets

### Upload Media

```http
POST /api/v1/media/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <binary>
type: IMAGE              # IMAGE | VIDEO | AUDIO | DOCUMENT | STICKER
messageId: <optional>    # Link to a message
```

### List Media

```http
GET /api/v1/media
Authorization: Bearer <token>
```

### Get Media for Message

```http
GET /api/v1/media/message/:messageId
Authorization: Bearer <token>
```

### Delete Media

```http
DELETE /api/v1/media/:id
Authorization: Bearer <token>
```

---

## API Keys

### Generate API Key (Admin)

```http
POST /api/v1/api-keys
Authorization: Bearer <admin-token>
Content-Type: application/json

{
  "name": "Production API Key",
  "scopes": ["messaging:send", "contacts:read"],
  "expiresAt": "2026-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "data": {
    "id": "uuid",
    "key": "ek_live_abc123...",
    "scopes": ["messaging:send", "contacts:read"]
  }
}
```

> **Important:** The raw key is only returned once at creation time.

### List API Keys

```http
GET /api/v1/api-keys
Authorization: Bearer <admin-token>
```

---

## Analytics

### Dashboard Summary

```http
GET /api/v1/analytics/dashboard
Authorization: Bearer <admin-token>
```

**Response:**
```json
{
  "data": {
    "messages": { "total": 5000, "sent": 4800, "failed": 200 },
    "conversations": { "total": 350, "open": 120 },
    "campaigns": { "total": 15, "completed": 10 },
    "contacts": { "total": 2000 }
  }
}
```

### Message Volume

```http
GET /api/v1/analytics/messages/volume?startDate=2025-01-01&endDate=2025-12-31&interval=monthly
Authorization: Bearer <admin-token>
```

### Provider Health

```http
GET /api/v1/analytics/providers/health
Authorization: Bearer <admin-token>
```

---

## Billing

### Usage Summary

```http
GET /api/v1/billing/summary?startDate=2025-01-01&endDate=2025-01-31
Authorization: Bearer <admin-token>
```

### Usage Details

```http
GET /api/v1/billing/usage?page=1&limit=50
Authorization: Bearer <admin-token>
```

---

## Settings

### System Settings (Admin)

```http
GET /api/v1/settings/system
POST /api/v1/settings/system
PUT /api/v1/settings/system/:id
DELETE /api/v1/settings/system/:id
Authorization: Bearer <admin-token>
```

### User Preferences

```http
GET /api/v1/settings/preferences
PUT /api/v1/settings/preferences/:key
Authorization: Bearer <token>
```

---

## Webhooks (Public)

### Verify Webhook

```http
GET /api/v1/messaging/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<challenge>
```

### Process Incoming Webhook

```http
POST /api/v1/messaging/webhooks/whatsapp
X-Hub-Signature-256: sha256=<hmac>
Content-Type: application/json

{
  "object": "whatsapp_business_account",
  "entry": [...]
}
```

---

## Notifications

### List Notifications

```http
GET /api/v1/notifications?page=1&limit=20
Authorization: Bearer <token>
```

### Mark as Read

```http
PATCH /api/v1/notifications/:id/read
Authorization: Bearer <token>
```

---

## Audit Logs (Admin)

```http
GET /api/v1/audit?page=1&limit=20&action=CREATE&resource=Message
Authorization: Bearer <admin-token>
```

---

## Health Checks

```http
GET /api/v1/health          # Full health (DB + Redis)
GET /api/v1/health/ping     # Lightweight liveness
```

---

## Pagination

All list endpoints support pagination:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `page` | 1 | Page number |
| `limit` | 20 | Items per page (max 100) |
| `search` | - | Search filter (where supported) |

**Response meta:**
```json
{
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNextPage": true,
    "hasPreviousPage": false
  }
}
```

## Error Codes

| Status | Error Code | Description |
|--------|-----------|-------------|
| 400 | `VALIDATION_ERROR` | Request body validation failed |
| 401 | `UNAUTHORIZED` | Missing or invalid JWT token |
| 403 | `FORBIDDEN` | Insufficient role or permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Duplicate resource (e.g., email exists) |
| 429 | `TOO_MANY_REQUESTS` | Rate limit exceeded |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
