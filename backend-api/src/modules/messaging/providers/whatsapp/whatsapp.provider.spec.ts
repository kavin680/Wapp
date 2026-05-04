import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { WhatsAppProvider } from './whatsapp.provider';
import type { SendMessagePayload, TemplatePayload } from '../../interfaces';

describe('WhatsAppProvider', () => {
  let provider: WhatsAppProvider;

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const config: Record<string, string> = {
        'messaging.whatsapp.apiUrl': 'https://graph.facebook.com/v21.0',
        'messaging.whatsapp.apiToken': 'test-token',
        'messaging.whatsapp.phoneNumberId': '12345',
        'messaging.whatsapp.businessAccountId': '67890',
        'messaging.whatsapp.appSecret': 'test-secret',
        'messaging.whatsapp.webhookVerifyToken': 'verify-token',
      };
      return config[key] ?? defaultValue ?? '';
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsAppProvider,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    provider = module.get<WhatsAppProvider>(WhatsAppProvider);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
    expect(provider.providerType).toBe('WHATSAPP');
  });

  describe('configure', () => {
    it('should update configuration', () => {
      provider.configure({ apiToken: 'new-token', phoneNumberId: '99999' });
      expect(provider.providerType).toBe('WHATSAPP');
    });
  });

  describe('sendMessage', () => {
    const payload: SendMessagePayload = {
      to: '+1234567890',
      type: 'text',
      content: { body: 'Hello World' },
    };

    it('should return success on 200 response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            messages: [{ id: 'wamid.123' }],
          }),
      });

      const result = await provider.sendMessage(payload);

      expect(result.success).toBe(true);
      expect(result.externalId).toBe('wamid.123');
    });

    it('should return failure on error response', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            error: { code: 190, message: 'Invalid access token' },
          }),
      });

      const result = await provider.sendMessage(payload);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('190');
      expect(result.error).toBe('Invalid access token');
    });

    it('should handle network errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network timeout'));

      const result = await provider.sendMessage(payload);

      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('NETWORK_ERROR');
      expect(result.error).toBe('Network timeout');
    });

    it('should build correct body for image messages', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: 'wamid.456' }] }),
      });

      await provider.sendMessage({
        to: '+1234567890',
        type: 'image',
        content: { url: 'https://example.com/img.jpg', caption: 'Test' },
      });

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.type).toBe('image');
      expect(body.image.link).toBe('https://example.com/img.jpg');
      expect(body.image.caption).toBe('Test');
    });
  });

  describe('sendTemplateMessage', () => {
    it('should send template with variables', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: 'wamid.789' }] }),
      });

      const result = await provider.sendTemplateMessage({
        to: '+1234567890',
        type: 'template',
        content: {},
        templateName: 'welcome',
        templateLanguage: 'en',
        templateVariables: [{ name: 'John' }],
      });

      expect(result.success).toBe(true);
      const fetchCall = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.type).toBe('template');
      expect(body.template.name).toBe('welcome');
    });
  });

  describe('createTemplate', () => {
    const templatePayload: TemplatePayload = {
      name: 'test_template',
      language: 'en',
      category: 'marketing',
      components: [{ type: 'BODY', text: 'Hello {{1}}' }],
    };

    it('should create template successfully', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'tmpl-123', status: 'APPROVED' }),
      });

      const result = await provider.createTemplate(templatePayload);

      expect(result.success).toBe(true);
      expect(result.externalId).toBe('tmpl-123');
    });

    it('should handle template creation failure', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        json: () =>
          Promise.resolve({
            error: { message: 'Template name already exists' },
          }),
      });

      const result = await provider.createTemplate(templatePayload);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Template name already exists');
    });
  });

  describe('verifyWebhook', () => {
    it('should return challenge for valid verification', () => {
      const result = provider.verifyWebhook({
        mode: 'subscribe',
        token: 'verify-token',
        challenge: 'challenge-123',
      });

      expect(result).toBe('challenge-123');
    });

    it('should return null for invalid token', () => {
      const result = provider.verifyWebhook({
        mode: 'subscribe',
        token: 'wrong-token',
        challenge: 'challenge-123',
      });

      expect(result).toBeNull();
    });

    it('should return null for wrong mode', () => {
      const result = provider.verifyWebhook({
        mode: 'unsubscribe',
        token: 'verify-token',
        challenge: 'challenge-123',
      });

      expect(result).toBeNull();
    });
  });

  describe('processWebhook', () => {
    it('should extract incoming messages from webhook', async () => {
      const body = {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: '12345' },
                  messages: [
                    {
                      id: 'msg-1',
                      from: '+1234567890',
                      type: 'text',
                      text: { body: 'Hi' },
                    },
                  ],
                  contacts: [{ profile: { name: 'John' } }],
                },
              },
            ],
          },
        ],
      };

      const events = await provider.processWebhook(body);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('message');
    });

    it('should extract status updates from webhook', async () => {
      const body = {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: '12345' },
                  statuses: [
                    {
                      id: 'wamid.123',
                      status: 'delivered',
                      timestamp: '1234567890',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const events = await provider.processWebhook(body);

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('status');
    });

    it('should reject invalid signature', async () => {
      const events = await provider.processWebhook(
        { entry: [{ changes: [{ value: { messages: [{ id: 'x' }] } }] }] },
        'sha256=invalid',
      );

      expect(events).toHaveLength(0);
    });

    it('should return empty for body without entry', async () => {
      const events = await provider.processWebhook({});
      expect(events).toHaveLength(0);
    });
  });
});
