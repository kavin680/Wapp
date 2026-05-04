import { registerAs } from '@nestjs/config';

export default registerAs('messaging', () => ({
  whatsapp: {
    apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0',
    apiToken: process.env.WHATSAPP_API_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '',
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || '',
    appSecret: process.env.WHATSAPP_APP_SECRET || '',
  },
  retry: {
    maxAttempts: parseInt(process.env.MESSAGE_RETRY_MAX_ATTEMPTS || '3', 10),
    backoffMs: parseInt(process.env.MESSAGE_RETRY_BACKOFF_MS || '1000', 10),
  },
  campaign: {
    batchSize: parseInt(process.env.CAMPAIGN_BATCH_SIZE || '50', 10),
    rateLimit: parseInt(process.env.CAMPAIGN_RATE_LIMIT || '80', 10),
    schedulerIntervalMs: parseInt(
      process.env.CAMPAIGN_SCHEDULER_INTERVAL_MS || '60000',
      10,
    ),
  },
  billing: {
    enabled: process.env.BILLING_ENABLED === 'true',
    defaultCurrency: process.env.BILLING_DEFAULT_CURRENCY || 'USD',
  },
}));
