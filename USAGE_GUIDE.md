# Wapp — Getting Started Guide

This guide walks you through setting up Wapp and sending your first WhatsApp message. No prior experience needed.

---

## What is Wapp?

Wapp is a backend platform that lets you send and receive WhatsApp messages programmatically using Meta's WhatsApp Business Cloud API. You can:

- Send text, image, video, document, and template messages
- Manage contacts with opt-in/opt-out consent
- View conversations in an inbox-style dashboard
- Run bulk messaging campaigns
- Track delivery analytics
- Receive incoming messages via webhooks

---

## Step 1 — Install and Start

**Requirements:** Node.js 18+, Docker

```bash
# Clone the repo
git clone https://github.com/kavin680/Wapp.git
cd Wapp/backend-api

# Copy the config file
cp .env.example .env

# Install dependencies
npm install

# Start the database
docker compose up -d postgres

# Set up database tables and seed test data
npx prisma db push
npx prisma db seed

# Start the server
npm run start:dev
```

You should see `Application is running on: http://localhost:3000` in the terminal.

---

## Step 2 — Explore the App

Open these URLs in your browser:

| Page | URL | What it does |
|------|-----|-------------|
| Admin Dashboard | http://localhost:3000/admin | Visual UI to manage everything |
| API Docs (Swagger) | http://localhost:3000/docs | Interactive API documentation |
| Health Check | http://localhost:3000/api/v1/health/ping | Verify the server is running |

### Login to the Admin Dashboard

- **Email:** `admin@enterprise.com`
- **Password:** `Admin@123456`

From the dashboard you can manage providers, contacts, messages, campaigns, templates, and settings — all without writing any code.

---

## Step 3 — Connect Your WhatsApp Account

You need a Meta Developer account with a WhatsApp Business app. If you don't have one yet:

1. Go to [developers.facebook.com](https://developers.facebook.com)
2. Create a new app → Select **Business** type
3. Add the **WhatsApp** product
4. Go to **WhatsApp → API Setup**

Copy these values into your `.env` file:

```env
WHATSAPP_API_TOKEN=your_access_token_here
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_BUSINESS_ACCOUNT_ID=your_business_account_id_here
WHATSAPP_WEBHOOK_VERIFY_TOKEN=pick_any_secret_string
WHATSAPP_APP_SECRET=your_app_secret_here
```

After updating `.env`, restart the server (`Ctrl+C` then `npm run start:dev`).

---

## Step 4 — Send Your First Message

### Option A — Using the API (curl)

```bash
# 1. Login and get your token
TOKEN=$(curl -s http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@enterprise.com","password":"Admin@123456"}' \
  | jq -r '.data.accessToken')

# 2. Create a WhatsApp provider
PROVIDER=$(curl -s -X POST http://localhost:3000/api/v1/messaging/providers \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"name": "My WhatsApp", "type": "WHATSAPP"}')

echo $PROVIDER | jq .

# 3. Send a text message (replace the phone number with a real one)
curl -X POST http://localhost:3000/api/v1/messaging/send \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "to": "+1234567890",
    "type": "TEXT",
    "content": { "body": "Hello from Wapp!" }
  }'
```

### Option B — Using Swagger UI

1. Open http://localhost:3000/docs
2. Click the **Authorize** button (lock icon, top-right)
3. Enter your token: `Bearer <your_access_token>`
4. Find `POST /api/v1/messaging/send` → click **Try it out**
5. Fill in the request body and click **Execute**

### Option C — Using the Admin Dashboard

1. Open http://localhost:3000/admin
2. Login with `admin@enterprise.com` / `Admin@123456`
3. Go to **Providers** → create a new WhatsApp provider
4. Go to **Messages** → compose and send

---

## Step 5 — Manage Contacts

Contacts track who you're messaging, with consent management built in.

```bash
# Create a contact
curl -X POST http://localhost:3000/api/v1/contacts \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "phoneNumber": "+1234567890",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Bulk import multiple contacts
curl -X POST http://localhost:3000/api/v1/contacts/import \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "contacts": [
      {"phoneNumber": "+1111111111", "firstName": "Alice"},
      {"phoneNumber": "+2222222222", "firstName": "Bob"}
    ]
  }'

# List all contacts
curl http://localhost:3000/api/v1/contacts \
  -H "Authorization: Bearer $TOKEN"
```

---

## Step 6 — Run a Campaign (Bulk Messaging)

Campaigns let you send the same message to many contacts at once.

```bash
# 1. Create a campaign (replace PROVIDER_ID with the ID from Step 4)
CAMPAIGN=$(curl -s -X POST http://localhost:3000/api/v1/campaigns \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Welcome Campaign",
    "providerId": "PROVIDER_ID"
  }')

CAMPAIGN_ID=$(echo $CAMPAIGN | jq -r '.data.id')

# 2. Add recipients (use contact IDs from Step 5)
curl -X POST http://localhost:3000/api/v1/campaigns/$CAMPAIGN_ID/recipients \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"contactIds": ["contact-id-1", "contact-id-2"]}'

# 3. Start the campaign
curl -X PATCH http://localhost:3000/api/v1/campaigns/$CAMPAIGN_ID/start \
  -H "Authorization: Bearer $TOKEN"

# 4. Check campaign stats
curl http://localhost:3000/api/v1/campaigns/$CAMPAIGN_ID/stats \
  -H "Authorization: Bearer $TOKEN"
```

---

## Step 7 — Receive Messages (Webhooks)

To receive incoming WhatsApp messages and delivery status updates:

1. Deploy your app to a public URL (or use [ngrok](https://ngrok.com) for testing):
   ```bash
   ngrok http 3000
   ```
2. In Meta Developer Dashboard → **WhatsApp → Configuration → Webhook**:
   - **Callback URL:** `https://your-url.ngrok.io/api/v1/messaging/webhooks/WHATSAPP`
   - **Verify Token:** same value as `WHATSAPP_WEBHOOK_VERIFY_TOKEN` in your `.env`
3. Subscribe to: `messages`, `message_template_status_update`

Incoming messages will automatically create conversations you can view in the dashboard or via `GET /api/v1/conversations`.

---

## Step 8 — View Analytics

```bash
# Dashboard overview (message counts, delivery rates)
curl http://localhost:3000/api/v1/analytics/dashboard \
  -H "Authorization: Bearer $TOKEN"

# Message volume over time
curl http://localhost:3000/api/v1/analytics/volume \
  -H "Authorization: Bearer $TOKEN"

# Billing summary (usage per channel)
curl http://localhost:3000/api/v1/billing/summary \
  -H "Authorization: Bearer $TOKEN"
```

---

## Common API Endpoints

| What you want to do | Method | Endpoint |
|---------------------|--------|----------|
| Login | POST | `/api/v1/auth/login` |
| Send a message | POST | `/api/v1/messaging/send` |
| List contacts | GET | `/api/v1/contacts` |
| Create a contact | POST | `/api/v1/contacts` |
| List conversations | GET | `/api/v1/conversations` |
| View conversation messages | GET | `/api/v1/conversations/:id/messages` |
| Create a campaign | POST | `/api/v1/campaigns` |
| Start a campaign | PATCH | `/api/v1/campaigns/:id/start` |
| List templates | GET | `/api/v1/templates` |
| View analytics | GET | `/api/v1/analytics/dashboard` |
| Check server health | GET | `/api/v1/health/ping` |

> Full API reference with request/response schemas: http://localhost:3000/docs

---

## Message Types

Wapp supports these WhatsApp message types:

| Type | Use case | Example `content` |
|------|----------|-------------------|
| `TEXT` | Plain text messages | `{"body": "Hello!"}` |
| `TEMPLATE` | Pre-approved template messages | `{}` (with `templateName` and `templateLanguage`) |
| `IMAGE` | Send an image | `{"url": "https://example.com/photo.jpg"}` |
| `VIDEO` | Send a video | `{"url": "https://example.com/video.mp4"}` |
| `DOCUMENT` | Send a PDF/document | `{"url": "https://example.com/file.pdf", "filename": "invoice.pdf"}` |
| `AUDIO` | Send an audio clip | `{"url": "https://example.com/audio.mp3"}` |

---

## User Roles

| Role | What they can do |
|------|-----------------|
| `USER` | Send messages, manage own contacts, view conversations |
| `ADMIN` | Everything USER can do + manage providers, templates, system settings |
| `SUPER_ADMIN` | Full access including user management and audit logs |

**Test accounts (pre-seeded):**

| Email | Password | Role |
|-------|----------|------|
| `admin@enterprise.com` | `Admin@123456` | SUPER_ADMIN |
| `user@enterprise.com` | `Admin@123456` | USER |

---

## Useful Commands

| Command | What it does |
|---------|-------------|
| `npm run start:dev` | Start the server (auto-restarts on code changes) |
| `npm run build` | Build for production |
| `npm run test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run lint` | Check code style |
| `npm run prisma:studio` | Open a visual database browser |

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Server won't start | Make sure PostgreSQL is running: `docker compose up -d postgres` |
| Database errors | Reset the database: `npx prisma db push --force-reset --accept-data-loss && npx prisma db seed` |
| Message fails to send | Check your WhatsApp credentials in `.env`. Without valid credentials, messages are created but marked as failed — this is expected |
| Port 3000 already in use | Kill the old process: `lsof -ti:3000 \| xargs kill` |
| Can't login to admin | Use `admin@enterprise.com` / `Admin@123456` (case-sensitive password) |

---

## Next Steps

- Read the [Architecture Guide](backend-api/docs/ARCHITECTURE.md) to understand the codebase
- Read the [Messaging Guide](backend-api/docs/MESSAGING.md) for advanced messaging features
- Set up [Webhooks](backend-api/docs/WEBHOOKS.md) to receive incoming messages
- Check the [Deployment Guide](backend-api/docs/DEPLOYMENT.md) for production setup
