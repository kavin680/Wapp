# Webhook Integration Guide

## Overview

The platform processes incoming webhooks from messaging providers (e.g., WhatsApp Cloud API) to handle:
- **Incoming messages** — Messages sent by contacts to your business number
- **Delivery statuses** — Sent, delivered, read, failed status updates
- **Webhook verification** — Provider handshake for endpoint validation

## WhatsApp Cloud API Webhook Setup

### 1. Configure Provider

First, create and configure a messaging provider:

```bash
# Create provider
curl -X POST http://localhost:3000/api/v1/messaging/providers \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "WhatsApp Production",
    "type": "WHATSAPP",
    "isActive": true
  }'

# Configure with credentials
curl -X POST http://localhost:3000/api/v1/messaging/providers/<id>/configure \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": { "apiToken": "<META_ACCESS_TOKEN>" },
    "phoneNumberId": "<PHONE_NUMBER_ID>",
    "businessAccountId": "<BUSINESS_ACCOUNT_ID>"
  }'
```

The response includes a `webhookSecret` — save this for Meta webhook configuration.

### 2. Configure Meta Webhook

In [Meta Developer Dashboard](https://developers.facebook.com/):

1. Go to your App → **WhatsApp** → **Configuration**
2. Set **Callback URL**: `https://your-domain.com/api/v1/messaging/webhooks/whatsapp`
3. Set **Verify Token**: Use the `webhookSecret` from step 1
4. Subscribe to fields: `messages`, `messaging_postbacks`

### 3. Webhook Verification Flow

When Meta sends a verification request:

```
GET /api/v1/messaging/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=<challenge>
```

The platform:
1. Finds the provider config with matching `webhookSecret`
2. Calls `WhatsAppProvider.verifyWebhook()` to validate the token
3. Returns the `hub.challenge` value if valid
4. Returns 403 if token doesn't match

### 4. Incoming Webhook Processing

When Meta sends a webhook event:

```
POST /api/v1/messaging/webhooks/whatsapp
X-Hub-Signature-256: sha256=<hmac>
Content-Type: application/json

{
  "object": "whatsapp_business_account",
  "entry": [{
    "id": "<BUSINESS_ACCOUNT_ID>",
    "changes": [{
      "value": {
        "messaging_product": "whatsapp",
        "messages": [{
          "from": "1234567890",
          "type": "text",
          "text": { "body": "Hello!" },
          "timestamp": "1234567890"
        }],
        "statuses": [{
          "id": "wamid.xxx",
          "status": "delivered",
          "timestamp": "1234567890"
        }]
      }
    }]
  }]
}
```

The platform:
1. Validates the `X-Hub-Signature-256` HMAC signature
2. Extracts messages and status updates via `WhatsAppProvider.processWebhook()`
3. Stores the raw event in `WebhookEvent` table
4. For incoming messages:
   - Creates or finds the `Contact`
   - Creates or finds the `Conversation`
   - Creates a `Message` record (direction: `INBOUND`)
   - Emits `message.incoming` event → creates a notification
5. For status updates:
   - Finds the matching `Message` by `externalId`
   - Creates a `MessageStatus` record (sent, delivered, read, failed)

## Webhook Event Storage

All raw webhook payloads are stored in the `WebhookEvent` table for debugging and replay:

```http
GET /api/v1/webhook-events?page=1&limit=20
Authorization: Bearer <admin-token>
```

Each event includes:
- `provider`: Provider type (WHATSAPP)
- `eventType`: Event classification
- `payload`: Raw JSON payload
- `processed`: Whether it was successfully processed
- `error`: Error message if processing failed

## Security

### Signature Verification

WhatsApp webhooks include an `X-Hub-Signature-256` header containing an HMAC-SHA256 signature of the request body, signed with the app secret. The platform verifies this signature before processing.

### Public Endpoints

Webhook endpoints are marked `@Public()` — they don't require JWT authentication. Security is handled via:
1. HMAC signature verification (for WhatsApp)
2. Verify token validation (for webhook registration)
3. Provider-specific credential verification

### Rate Limiting

Webhook endpoints are subject to global rate limiting (100 requests/60 seconds). For high-volume production use, consider:
- Increasing the global throttle limit
- Adding webhook-specific rate limits
- Using a queue to buffer incoming webhooks

## Event System

Webhook events trigger the internal event system:

| Event | Trigger | Action |
|-------|---------|--------|
| `message.incoming` | New inbound message received | Creates user notification |
| `message.processed` | Message send attempt completed | Creates notification on failure |

## Testing Webhooks Locally

### Using ngrok

```bash
# Expose local server
ngrok http 3000

# Use the ngrok URL as your webhook URL in Meta Dashboard
# https://abc123.ngrok.io/api/v1/messaging/webhooks/whatsapp
```

### Manual Testing

```bash
# Simulate verification
curl "http://localhost:3000/api/v1/messaging/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=<your-webhook-secret>&hub.challenge=test123"

# Simulate incoming message
curl -X POST http://localhost:3000/api/v1/messaging/webhooks/whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "BUSINESS_ID",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "messages": [{
            "from": "1234567890",
            "type": "text",
            "text": { "body": "Test message" },
            "timestamp": "1234567890"
          }]
        }
      }]
    }]
  }'
```

## Adding Webhooks for New Providers

When implementing a new provider, the `processWebhook()` method should return:

```typescript
{
  messages: [
    {
      from: string,        // Sender phone/ID
      type: string,        // text, image, etc.
      content: any,        // Provider-specific content
      timestamp: string,   // Unix timestamp
      externalId: string,  // Provider message ID
    }
  ],
  statuses: [
    {
      externalId: string,  // Message ID
      status: string,      // sent, delivered, read, failed
      timestamp: string,
    }
  ]
}
```

The `MessagingService.processWebhook()` method handles the rest (contact lookup, conversation management, message storage, event emission) provider-agnostically.
