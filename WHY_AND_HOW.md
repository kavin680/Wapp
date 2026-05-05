# Wapp — Why & How Guide

This document explains **why** each feature exists and **how** to use it. Whether you're a developer integrating the API or a business user working from the admin dashboard, this guide will help you understand the full platform.

---

## Why Wapp?

Sending WhatsApp messages manually doesn't scale. When your business needs to:

- **Send notifications** — order confirmations, shipping updates, appointment reminders
- **Run marketing campaigns** — promotions, announcements to thousands of contacts
- **Handle customer support** — receive and reply to incoming messages
- **Track compliance** — know who opted in, who opted out, what was delivered

...you need a **messaging platform**, not just an API wrapper. Wapp gives you all of this as a self-hosted backend you fully control — your data never passes through a third party.

---

## Feature Overview

| Feature | Why it exists | Where to use it |
|---------|--------------|-----------------|
| [Providers](#1-providers) | Connect your WhatsApp credentials securely | Admin → Providers |
| [Contacts](#2-contacts) | Track who you message and their consent status | Admin → Contacts |
| [Messages](#3-messages) | Send and track message delivery | Admin → Messages |
| [Conversations](#4-conversations) | View threaded message history per contact | Admin → Conversations |
| [Templates](#5-templates) | Create pre-approved message templates | Admin → Templates |
| [Campaigns](#6-campaigns) | Send bulk messages to many contacts at once | Admin → Campaigns |
| [Media](#7-media) | Upload and manage files for messages | Admin → Media |
| [Settings](#8-settings) | Configure system behavior | Admin → Settings |
| [Analytics](#9-analytics) | Track delivery rates and message volume | API only |
| [Webhooks](#10-webhooks) | Receive incoming messages and delivery updates | API + Meta Dashboard |
| [Auth & RBAC](#11-authentication--roles) | Secure access with role-based permissions | API + Admin |

---

## 1. Providers

### Why?

A **provider** is your connection to WhatsApp (or any messaging channel). It stores your API credentials securely (encrypted with AES-256-GCM) so the platform can send messages on your behalf. You might have multiple providers — one for production, one for testing, or different ones for different channels (WhatsApp, SMS, etc.).

### How to Use — Admin Dashboard

1. Go to **Admin → Providers**
2. Click **+ Add Provider**
3. Fill in:
   - **Provider Name** — a label for your reference (e.g., "WhatsApp Production")
   - **Type** — select WhatsApp
   - **Channel** — select WhatsApp
4. Click **Create Provider**
5. In the providers table, click **Configure** on your new provider
6. Enter your WhatsApp credentials:
   - **API Token** — from Meta Developer Dashboard → API Setup → Access Token
   - **Phone Number ID** — from Meta → API Setup → Phone Number ID
   - **Business Account ID** — from Meta → API Setup → WhatsApp Business Account ID
   - **Webhook Verify Token** — any secret string you choose (you'll use the same value in Meta's webhook settings)
7. Click **Save Configuration**

### How to Use — API

```bash
# Create a provider
curl -X POST http://localhost:3000/api/v1/messaging/providers \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "WhatsApp Production", "type": "WHATSAPP"}'

# Configure it with your credentials
curl -X POST http://localhost:3000/api/v1/messaging/providers/PROVIDER_ID/configure \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "credentials": {
      "apiToken": "your_whatsapp_token",
      "webhookVerifyToken": "your_verify_token"
    },
    "phoneNumberId": "your_phone_number_id",
    "businessAccountId": "your_business_account_id"
  }'
```

### Why Multiple Providers?

- **Testing vs Production** — keep a test provider with Meta's test phone number separate from your live one
- **Multiple Business Lines** — different phone numbers for different departments
- **Future Channels** — add SMS or Telegram providers later without changing your code

---

## 2. Contacts

### Why?

Contacts are the people you message. Wapp tracks every contact with their consent status (opt-in/opt-out) so you stay compliant with WhatsApp's policies. Without consent management, your business number can get blocked by Meta.

### How to Use — Admin Dashboard

1. Go to **Admin → Contacts**
2. Click **+ Add Contact**
3. Fill in:
   - **First Name** (required)
   - **Last Name**
   - **Phone Number** (required, international format: +1234567890)
   - **Email**
   - **Channel** — WhatsApp, SMS, or Email
   - **External ID** — your own reference (e.g., customer ID from your CRM)
4. Click **Add Contact**

**Managing consent:**
- Click **Opt-out** next to a contact to mark them as opted out (you can no longer send them messages)
- Click **Opt-in** to reverse it
- Click **Delete** to remove a contact entirely

### How to Use — API

```bash
# Create a single contact
curl -X POST http://localhost:3000/api/v1/contacts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com"
  }'

# Bulk import contacts
curl -X POST http://localhost:3000/api/v1/contacts/import \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "contacts": [
      {"phoneNumber": "+1111111111", "firstName": "Alice"},
      {"phoneNumber": "+2222222222", "firstName": "Bob"},
      {"phoneNumber": "+3333333333", "firstName": "Charlie"}
    ]
  }'

# List all contacts
curl http://localhost:3000/api/v1/contacts \
  -H "Authorization: Bearer $TOKEN"

# Opt out a contact
curl -X PATCH http://localhost:3000/api/v1/contacts/CONTACT_ID/opt-out \
  -H "Authorization: Bearer $TOKEN"
```

### Why Consent Matters

WhatsApp requires **explicit user consent** before you message them. If you send messages to people who haven't opted in, Meta can:
- Block your messages
- Reduce your messaging limit
- Ban your business number entirely

Wapp tracks opt-in status per contact so you never accidentally violate this policy.

---

## 3. Messages

### Why?

This is the core feature — sending messages to your contacts via WhatsApp. Wapp supports text messages, template messages (required for initiating conversations outside the 24-hour window), media messages (images, videos, documents), and more.

### How to Use — Admin Dashboard

1. Go to **Admin → Messages**
2. In the **Send Message** section:
   - **Provider** — select which WhatsApp provider to use
   - **Recipient** — enter the phone number (+1234567890)
   - **Message** — type your message
3. Click **Send Message**

The **Message History** table below shows all sent and received messages with their delivery status.

### How to Use — API

```bash
# Send a text message
curl -X POST http://localhost:3000/api/v1/messaging/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "type": "TEXT",
    "content": {"body": "Hello! Your order has been shipped."}
  }'

# Send a template message (for messages outside the 24-hour window)
curl -X POST http://localhost:3000/api/v1/messaging/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "type": "TEMPLATE",
    "content": {},
    "templateName": "hello_world",
    "templateLanguage": "en_US"
  }'

# Send an image
curl -X POST http://localhost:3000/api/v1/messaging/send \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "type": "IMAGE",
    "content": {"url": "https://example.com/photo.jpg", "caption": "Check this out!"}
  }'
```

### Message Types Explained

| Type | When to use | 24-hour rule |
|------|-------------|--------------|
| **TEXT** | General conversations | Only within 24h of last user message |
| **TEMPLATE** | Starting new conversations, notifications | Anytime (requires Meta approval) |
| **IMAGE** | Sending photos, screenshots | Within 24h |
| **VIDEO** | Sending video clips | Within 24h |
| **DOCUMENT** | Sending PDFs, invoices, receipts | Within 24h |
| **AUDIO** | Sending voice messages | Within 24h |

### Why the 24-Hour Rule?

WhatsApp enforces a **24-hour messaging window**. After a user messages you, you can reply with any message type for 24 hours. After that, you can only send **pre-approved template messages**. This prevents businesses from spamming users.

---

## 4. Conversations

### Why?

Conversations group messages by contact into threads — like an inbox. This lets you see the full message history with each person, know which conversations need attention, and assign conversations to team members.

### How to Use — Admin Dashboard

1. Go to **Admin → Conversations**
2. View the inbox table showing:
   - **Contact** — the phone number
   - **Channel** — WhatsApp, SMS, etc.
   - **Status** — Open, Closed, or Archived
   - **Last Message** — preview of the most recent message
   - **Messages** — total message count
   - **Updated** — when the last message was sent/received

### How to Use — API

```bash
# List all conversations
curl http://localhost:3000/api/v1/conversations \
  -H "Authorization: Bearer $TOKEN"

# Get messages in a specific conversation
curl http://localhost:3000/api/v1/conversations/CONVERSATION_ID/messages \
  -H "Authorization: Bearer $TOKEN"

# Close a conversation (mark as resolved)
curl -X PATCH http://localhost:3000/api/v1/conversations/CONVERSATION_ID/close \
  -H "Authorization: Bearer $TOKEN"

# Assign a conversation to a team member
curl -X PATCH http://localhost:3000/api/v1/conversations/CONVERSATION_ID/assign \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": "USER_ID"}'
```

### Why Conversations?

Without conversation threading, your message log is just a flat list. Conversations let you:
- See the full context of a customer interaction
- Track which customers are waiting for replies
- Assign support requests to specific team members
- Close resolved issues and keep your inbox clean

---

## 5. Templates

### Why?

WhatsApp requires **pre-approved templates** for messages sent outside the 24-hour window (e.g., notifications, reminders, marketing). You create a template, submit it to Meta for review, and once approved, you can use it to message anyone who has opted in — even if they haven't messaged you recently.

### How to Use — Admin Dashboard

1. Go to **Admin → Templates**
2. Click **+ New Template**
3. Fill in:
   - **Template Name** — lowercase, underscores (e.g., `order_confirmation`)
   - **Channel** — WhatsApp
   - **Category** — Marketing, Utility, or Authentication
   - **Language** — e.g., `en` for English
   - **Template Content** — the message text with variables like `{{1}}`, `{{2}}`
4. Click **Create Template**

Example template content:
```
Hello {{1}}, your order #{{2}} has been shipped and will arrive by {{3}}.
```

### How to Use — API

```bash
# Create a template
curl -X POST http://localhost:3000/api/v1/templates \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "order_shipped",
    "channel": "WHATSAPP",
    "category": "UTILITY",
    "language": "en",
    "content": "Hello {{1}}, your order #{{2}} has been shipped!"
  }'

# Submit for Meta approval
curl -X PATCH http://localhost:3000/api/v1/templates/TEMPLATE_ID/submit \
  -H "Authorization: Bearer $TOKEN"
```

### Template Categories

| Category | Use case | Approval speed |
|----------|----------|---------------|
| **UTILITY** | Order updates, receipts, account alerts | Usually fast |
| **MARKETING** | Promotions, offers, newsletters | May take longer |
| **AUTHENTICATION** | OTP codes, login verification | Usually fast |

---

## 6. Campaigns

### Why?

Campaigns let you send the same message to hundreds or thousands of contacts at once. Instead of sending messages one by one, you create a campaign, add recipients, and start it. Wapp handles the batch processing, rate limiting, and tracking automatically.

### How to Use — Admin Dashboard

1. Go to **Admin → Campaigns**
2. Click **+ New Campaign**
3. Fill in:
   - **Campaign Name** — e.g., "Holiday Sale Announcement"
   - **Provider** — select your WhatsApp provider
   - **Message Content** — the message text
   - **Scheduled At** (optional) — schedule for later
4. Click **Create Campaign**
5. Add recipients via the API (see below)
6. Click **Start** to begin sending

**Campaign controls:**
- **Start** — begin sending messages
- **Pause** — temporarily stop sending
- **Resume** — continue a paused campaign
- **Cancel** — stop permanently

### How to Use — API

```bash
# Create a campaign
CAMPAIGN=$(curl -s -X POST http://localhost:3000/api/v1/campaigns \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Holiday Sale",
    "providerId": "PROVIDER_ID"
  }')

CAMPAIGN_ID=$(echo $CAMPAIGN | jq -r '.data.id')

# Add recipients
curl -X POST http://localhost:3000/api/v1/campaigns/$CAMPAIGN_ID/recipients \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"contactIds": ["contact-id-1", "contact-id-2"]}'

# Start the campaign
curl -X PATCH http://localhost:3000/api/v1/campaigns/$CAMPAIGN_ID/start \
  -H "Authorization: Bearer $TOKEN"

# Check stats
curl http://localhost:3000/api/v1/campaigns/$CAMPAIGN_ID/stats \
  -H "Authorization: Bearer $TOKEN"
```

### Campaign Lifecycle

```
DRAFT → RUNNING → COMPLETED
                ↘ PAUSED → RUNNING (resumed)
                ↘ CANCELLED
                ↘ FAILED
```

### Why Not Just Loop Send?

You could write a loop that calls `/messaging/send` for each contact, but campaigns give you:
- **Rate limiting** — don't exceed WhatsApp's per-second limits
- **Batch processing** — handles thousands of recipients efficiently
- **Status tracking** — see how many sent, delivered, failed
- **Pause/Resume** — stop mid-campaign without losing progress
- **Scheduling** — send at a specific time

---

## 7. Media

### Why?

When you send images, videos, or documents via WhatsApp, the files need to be hosted somewhere accessible. The media module lets you upload files and get URLs that can be used in messages.

### How to Use — Admin Dashboard

1. Go to **Admin → Media**
2. Click **Upload** to add a file
3. Supported formats: JPEG, PNG, GIF, WebP, PDF, CSV, JSON, XLSX, DOCX
4. After upload, copy the media URL to use in messages

### How to Use — API

```bash
# Upload a file
curl -X POST http://localhost:3000/api/v1/media/upload \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@/path/to/image.jpg"
```

---

## 8. Settings

### Why?

System settings let you configure platform behavior without changing code. User preferences let each user customize their experience.

### How to Use — Admin Dashboard

1. Go to **Admin → Settings**
2. **System Settings** — platform-wide configuration (e.g., `max_retry_attempts: 3`)
3. **User Preferences** — per-user settings
4. Click **+ Add Setting** to create a new key-value setting

### How to Use — API

```bash
# List all system settings
curl http://localhost:3000/api/v1/settings/system \
  -H "Authorization: Bearer $TOKEN"

# Create a system setting
curl -X POST http://localhost:3000/api/v1/settings/system \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"key": "max_retry_attempts", "value": "3", "category": "messaging"}'

# List user preferences
curl http://localhost:3000/api/v1/settings/preferences \
  -H "Authorization: Bearer $TOKEN"
```

---

## 9. Analytics

### Why?

You need to know if your messages are being delivered. Analytics gives you delivery rates, message volume over time, and campaign performance — so you can identify problems (e.g., messages failing to deliver) and measure results.

### How to Use — API

```bash
# Dashboard overview
curl http://localhost:3000/api/v1/analytics/dashboard \
  -H "Authorization: Bearer $TOKEN"

# Message volume over time
curl http://localhost:3000/api/v1/analytics/volume \
  -H "Authorization: Bearer $TOKEN"
```

The admin **Dashboard** page also shows key metrics: total messages, contacts, campaigns, providers, templates, and conversations.

---

## 10. Webhooks

### Why?

Webhooks let you **receive** messages and delivery updates from WhatsApp in real time. Without webhooks, you'd have to keep polling the API to check for new messages — which is slow and wastes resources.

### How to Set Up

1. Deploy Wapp to a public URL (or use [ngrok](https://ngrok.com) for local testing):
   ```bash
   ngrok http 3000
   ```

2. In the **Meta Developer Dashboard**:
   - Go to **WhatsApp → Configuration → Webhook**
   - **Callback URL:** `https://your-domain.com/api/v1/messaging/webhooks/WHATSAPP`
   - **Verify Token:** same value as `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in your `.env`
   - Subscribe to: `messages`, `message_template_status_update`

3. Wapp will now automatically:
   - Create conversations for new incoming messages
   - Update message delivery statuses (sent → delivered → read)
   - Store raw webhook events for audit

### What Webhooks Deliver

| Event | What happens |
|-------|-------------|
| **Incoming message** | A contact sends you a WhatsApp message → Wapp creates a conversation and stores the message |
| **Message sent** | WhatsApp confirms your message was sent to their servers |
| **Message delivered** | The message was delivered to the recipient's phone |
| **Message read** | The recipient opened and read your message |
| **Message failed** | The message could not be delivered (e.g., invalid number, blocked) |

---

## 11. Authentication & Roles

### Why?

Not everyone should have the same access. A support agent should send messages but shouldn't delete providers. An admin should manage everything. Role-based access control (RBAC) enforces these boundaries.

### Roles

| Role | What they can do |
|------|-----------------|
| **USER** | Send messages, manage own contacts, view conversations |
| **ADMIN** | Everything USER can + manage providers, templates, settings |
| **SUPER_ADMIN** | Full access including user management and audit logs |

### How to Use

**Login via Admin Dashboard:**
1. Go to `http://localhost:3000/admin/login`
2. Enter email and password
3. You're in — the dashboard shows your role in the top-right corner

**Login via API:**
```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@enterprise.com","password":"Admin@123456"}' \
  | jq -r '.data.accessToken')

# Use the token for all API requests
curl http://localhost:3000/api/v1/contacts \
  -H "Authorization: Bearer $TOKEN"

# Check who you're logged in as
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### Test Accounts (Pre-seeded)

| Email | Password | Role |
|-------|----------|------|
| `admin@enterprise.com` | `Admin@123456` | SUPER_ADMIN |
| `user@enterprise.com` | `Admin@123456` | USER |

---

## Typical Workflow

Here's how everything fits together for a real use case:

### Scenario: Send a Promotional Campaign

```
1. CONFIGURE → Admin → Providers → Add WhatsApp → Configure credentials
2. IMPORT    → Admin → Contacts → Add contacts (or bulk import via API)
3. TEMPLATE  → Admin → Templates → Create "promo_announcement" template → Submit to Meta
4. CAMPAIGN  → Admin → Campaigns → Create campaign → Select provider → Add recipients → Start
5. TRACK     → Admin → Dashboard → Check delivery stats
6. RESPOND   → Admin → Conversations → View replies → Respond to customers
```

### Scenario: Transactional Notifications (API Integration)

```python
# Your backend code
import requests

WAPP_URL = "http://localhost:3000/api/v1"
TOKEN = "your_jwt_token"

def send_order_confirmation(phone, order_id, total):
    requests.post(f"{WAPP_URL}/messaging/send", 
        headers={"Authorization": f"Bearer {TOKEN}"},
        json={
            "to": phone,
            "type": "TEMPLATE",
            "templateName": "order_confirmation",
            "templateLanguage": "en_US",
            "content": {
                "parameters": [order_id, f"${total}"]
            }
        }
    )

# Called from your checkout flow
send_order_confirmation("+1234567890", "ORD-12345", "49.99")
```

---

## Where to Find More

| Document | Location | What it covers |
|----------|----------|---------------|
| **README** | [README.md](README.md) | Quick start, full API reference, architecture |
| **Usage Guide** | [USAGE_GUIDE.md](USAGE_GUIDE.md) | Step-by-step beginner tutorial |
| **Architecture** | [docs/ARCHITECTURE.md](backend-api/docs/ARCHITECTURE.md) | System design, module structure |
| **Messaging** | [docs/MESSAGING.md](backend-api/docs/MESSAGING.md) | Provider system, message processing |
| **Webhooks** | [docs/WEBHOOKS.md](backend-api/docs/WEBHOOKS.md) | Webhook setup and payload formats |
| **Auth** | [docs/AUTH.md](backend-api/docs/AUTH.md) | JWT, refresh tokens, RBAC details |
| **Security** | [docs/SECURITY.md](backend-api/docs/SECURITY.md) | Encryption, credential storage |
| **Deployment** | [docs/DEPLOYMENT.md](backend-api/docs/DEPLOYMENT.md) | Production deployment guide |
| **Swagger UI** | http://localhost:3000/docs | Interactive API documentation |
