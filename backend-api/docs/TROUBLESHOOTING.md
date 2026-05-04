# Troubleshooting Guide

## Common Issues

### Database Connection Failed
```
Error: Can't reach database server at `localhost:5432`
```
**Solution**: Ensure PostgreSQL is running.
```bash
# Docker
docker compose up postgres -d

# Or check service
sudo service postgresql status
```

### Prisma Client Not Generated
```
Error: @prisma/client did not initialize yet
```
**Solution**: Run `npx prisma generate` after installing dependencies.

### JWT Secret Not Set
```
Error: secretOrPrivateKey must have a value
```
**Solution**: Set `JWT_SECRET` and `JWT_REFRESH_SECRET` in your `.env` file:
```bash
openssl rand -hex 32  # Generate a strong secret
```

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3000
```
**Solution**: Change `APP_PORT` in `.env` or kill the process:
```bash
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill
```

### Redis Connection Refused
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```
**Solution**: 
- Start Redis: `docker compose up redis -d`
- Or disable Redis: `REDIS_ENABLED=false` and `QUEUE_ENABLED=false` in `.env`

### Migration Issues
```
Error: Migration failed
```
**Solution**: 
```bash
npx prisma migrate reset   # Reset and re-apply
npx prisma db push          # Or push schema directly
```

### Rate Limit Exceeded
```
Error: ThrottlerException: Too Many Requests
```
**Solution**: Wait 60 seconds for the rate limit window to reset.

---

## Messaging-Specific Issues

### Provider Configuration Fails
```
Error: Provider not found
```
**Solution**: Create a provider first, then configure it:
```bash
# 1. Create provider
POST /api/v1/messaging/providers { "name": "WhatsApp", "type": "WHATSAPP", "isActive": true }

# 2. Configure with credentials
POST /api/v1/messaging/providers/<id>/configure { "credentials": { "apiToken": "..." } }
```

### Message Send Returns Error but No 500
```
Response: { "success": true, "data": { "message": { "status": "FAILED" } } }
```
This is **expected behavior**. The platform creates the message record and handles the provider error gracefully. Check:
- Provider credentials are correct
- Phone number format includes country code (`+1234567890`)
- WhatsApp Business API is properly configured in Meta dashboard

### Credential Decryption Fails
```
Error: Invalid encrypted value format
```
**Causes**:
- `ENCRYPTION_KEY` changed after credentials were encrypted
- Credentials were stored before encryption was enabled

**Solution**: Re-configure the provider with new credentials:
```bash
POST /api/v1/messaging/providers/<id>/configure
```

### Queue Jobs Not Processing
**Symptoms**: Messages show `queued: true` but never get sent.

**Check**:
1. Redis is running: `redis-cli ping`
2. `QUEUE_ENABLED=true` in `.env`
3. Server is running (queue processors run in the same process)
4. Check Redis for failed jobs:
   ```bash
   redis-cli LLEN bull:messages:failed
   redis-cli LRANGE bull:messages:failed 0 -1
   ```

### Campaign Not Starting Automatically
**Symptoms**: Campaign has `scheduledAt` in the past but status is still `SCHEDULED`.

**Check**:
1. Campaign scheduler runs every 60s — wait at least one polling cycle
2. Check `CAMPAIGN_SCHEDULER_INTERVAL_MS` in `.env`
3. Verify campaign status is `SCHEDULED` (not `DRAFT`)
4. Check server logs for scheduler errors

### BullMQ Redis Version Warning
```
Warning: It is highly recommended to use a minimum Redis version of 6.2.0
```
**Solution**: Upgrade Redis to 7+ or 6.2+. This is a warning only — BullMQ works with older versions.

### Webhook Verification Fails
```
GET /api/v1/messaging/webhooks/whatsapp → 403
```
**Check**:
- `hub.verify_token` matches the `webhookSecret` from provider configuration
- Provider config exists for the webhook provider type
- Provider is active (`isActive: true`)

### File Upload Fails
```
Error: Cannot read properties of undefined (reading 'filename')
```
**Solution**: Ensure the request uses `multipart/form-data` with field name `file`:
```bash
curl -X POST http://localhost:3000/api/v1/media/upload \
  -H "Authorization: Bearer <token>" \
  -F "file=@photo.jpg" \
  -F "type=IMAGE"
```

### E2E Tests Fail with Database Error
```
Error: Can't reach database server at `localhost:5432`
```
**Solution**: E2E tests require PostgreSQL and Redis running:
```bash
docker compose up postgres redis -d
npx prisma db push
npx prisma db seed
npm run test:e2e
```

### Forbidden on Admin Endpoints
```
Error: 403 Forbidden
```
**Solution**: The endpoint requires `ADMIN` or `SUPER_ADMIN` role. Login as admin:
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@enterprise.com","password":"Admin@123456"}'
```

---

## Debug Mode

### Verbose Logging
```bash
LOG_LEVEL=debug npm run start:dev
```

### Node.js Inspector
```bash
npm run start:debug
# Attach VS Code debugger to port 9229
```

### Prisma Query Logging
```env
DATABASE_LOGGING=true
```

### Check Queue Status
```bash
# List all BullMQ queues
redis-cli KEYS "bull:*"

# Check pending jobs
redis-cli LLEN "bull:messages:wait"

# Check failed jobs
redis-cli LLEN "bull:messages:failed"

# Check completed jobs
redis-cli GET "bull:messages:id"
```
