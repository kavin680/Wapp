import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  IMessagingProvider,
  SendMessagePayload,
  SendMessageResult,
  TemplatePayload,
  TemplateResult,
  WebhookVerification,
} from '../../interfaces';

@Injectable()
export class WhatsAppProvider implements IMessagingProvider {
  private readonly logger = new Logger(WhatsAppProvider.name);
  readonly providerType = 'WHATSAPP';

  private apiUrl: string;
  private apiToken: string;
  private phoneNumberId: string;
  private appSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.apiUrl = this.configService.get<string>(
      'messaging.whatsapp.apiUrl',
      'https://graph.facebook.com/v21.0',
    );
    this.apiToken = this.configService.get<string>(
      'messaging.whatsapp.apiToken',
      '',
    );
    this.phoneNumberId = this.configService.get<string>(
      'messaging.whatsapp.phoneNumberId',
      '',
    );
    this.appSecret = this.configService.get<string>(
      'messaging.whatsapp.appSecret',
      '',
    );
  }

  configure(config: {
    apiToken?: string;
    phoneNumberId?: string;
    apiUrl?: string;
    appSecret?: string;
  }) {
    if (config.apiToken) this.apiToken = config.apiToken;
    if (config.phoneNumberId) this.phoneNumberId = config.phoneNumberId;
    if (config.apiUrl) this.apiUrl = config.apiUrl;
    if (config.appSecret) this.appSecret = config.appSecret;
  }

  async sendMessage(payload: SendMessagePayload): Promise<SendMessageResult> {
    const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;

    const body = this.buildMessageBody(payload);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        const error = data.error as Record<string, unknown> | undefined;
        const errorCode =
          error?.code !== undefined && error?.code !== null
            ? `${error.code as number}`
            : `${response.status}`;
        return {
          success: false,
          error: (error?.message as string) || 'Failed to send message',
          errorCode,
        };
      }

      const messages = data.messages as { id: string }[] | undefined;
      return {
        success: true,
        externalId: messages?.[0]?.id,
        metadata: data,
      };
    } catch (error) {
      this.logger.error(`WhatsApp send failed: ${(error as Error).message}`);
      return {
        success: false,
        error: (error as Error).message,
        errorCode: 'NETWORK_ERROR',
      };
    }
  }

  async sendTemplateMessage(
    payload: SendMessagePayload,
  ): Promise<SendMessageResult> {
    const url = `${this.apiUrl}/${this.phoneNumberId}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      to: payload.to,
      type: 'template',
      template: {
        name: payload.templateName,
        language: { code: payload.templateLanguage || 'en' },
        components: payload.templateVariables
          ? [
              {
                type: 'body',
                parameters: payload.templateVariables.map((v) => ({
                  type: 'text',
                  text: Object.values(v)[0],
                })),
              },
            ]
          : [],
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        const error = data.error as Record<string, unknown> | undefined;
        const errorCode =
          error?.code !== undefined && error?.code !== null
            ? `${error.code as number}`
            : `${response.status}`;
        return {
          success: false,
          error: (error?.message as string) || 'Failed to send template',
          errorCode,
        };
      }

      const messages = data.messages as { id: string }[] | undefined;
      return {
        success: true,
        externalId: messages?.[0]?.id,
        metadata: data,
      };
    } catch (error) {
      this.logger.error(
        `WhatsApp template send failed: ${(error as Error).message}`,
      );
      return {
        success: false,
        error: (error as Error).message,
        errorCode: 'NETWORK_ERROR',
      };
    }
  }

  async createTemplate(payload: TemplatePayload): Promise<TemplateResult> {
    const businessAccountId = this.configService.get<string>(
      'messaging.whatsapp.businessAccountId',
      '',
    );
    const url = `${this.apiUrl}/${businessAccountId}/message_templates`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: payload.name,
          language: payload.language,
          category: payload.category.toUpperCase(),
          components: payload.components,
        }),
      });

      const data = (await response.json()) as Record<string, unknown>;

      if (!response.ok) {
        const error = data.error as Record<string, unknown> | undefined;
        return {
          success: false,
          error: (error?.message as string) || 'Failed to create template',
        };
      }

      return {
        success: true,
        externalId: data.id as string,
        status: data.status as string,
      };
    } catch (error) {
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }

  async deleteTemplate(
    name: string,
  ): Promise<{ success: boolean; error?: string }> {
    const businessAccountId = this.configService.get<string>(
      'messaging.whatsapp.businessAccountId',
      '',
    );
    const url = `${this.apiUrl}/${businessAccountId}/message_templates?name=${name}`;

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${this.apiToken}` },
      });

      return { success: response.ok };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }

  verifyWebhook(verification: WebhookVerification): string | null {
    const verifyToken = this.configService.get<string>(
      'messaging.whatsapp.webhookVerifyToken',
      '',
    );

    if (
      verification.mode === 'subscribe' &&
      verification.token === verifyToken
    ) {
      return verification.challenge;
    }
    return null;
  }

  async processWebhook(
    body: Record<string, unknown>,
    signature?: string,
  ): Promise<Record<string, unknown>[]> {
    if (signature && this.appSecret) {
      const expectedSignature = crypto
        .createHmac('sha256', this.appSecret)
        .update(JSON.stringify(body))
        .digest('hex');

      if (signature !== `sha256=${expectedSignature}`) {
        this.logger.warn('Invalid webhook signature');
        return [];
      }
    }

    const events: Record<string, unknown>[] = [];
    const entry = body.entry as Record<string, unknown>[] | undefined;

    if (!entry) return events;

    for (const entryItem of entry) {
      const changes = entryItem.changes as
        | Record<string, unknown>[]
        | undefined;
      if (!changes) continue;

      for (const change of changes) {
        const value = change.value as Record<string, unknown> | undefined;
        if (!value) continue;

        const messages = value.messages as
          | Record<string, unknown>[]
          | undefined;
        if (messages) {
          for (const message of messages) {
            events.push({
              type: 'message',
              data: message,
              metadata: value.metadata,
              contacts: value.contacts,
            });
          }
        }

        const statuses = value.statuses as
          | Record<string, unknown>[]
          | undefined;
        if (statuses) {
          for (const status of statuses) {
            events.push({
              type: 'status',
              data: status,
              metadata: value.metadata,
            });
          }
        }
      }
    }

    return events;
  }

  async getMessageStatus(
    externalId: string,
  ): Promise<{ status: string; metadata?: Record<string, unknown> }> {
    const url = `${this.apiUrl}/${externalId}`;

    try {
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${this.apiToken}` },
      });

      const data = (await response.json()) as Record<string, unknown>;
      return { status: (data.status as string) || 'unknown', metadata: data };
    } catch {
      return { status: 'unknown' };
    }
  }

  private buildMessageBody(
    payload: SendMessagePayload,
  ): Record<string, unknown> {
    const base: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      to: payload.to,
      type: payload.type || 'text',
    };

    switch (payload.type) {
      case 'text':
        base.text = { body: payload.content.body || payload.content.text };
        break;
      case 'image':
        base.image = {
          link: payload.mediaUrl || payload.content.url,
          caption: payload.content.caption,
        };
        break;
      case 'video':
        base.video = {
          link: payload.mediaUrl || payload.content.url,
          caption: payload.content.caption,
        };
        break;
      case 'audio':
        base.audio = { link: payload.mediaUrl || payload.content.url };
        break;
      case 'document':
        base.document = {
          link: payload.mediaUrl || payload.content.url,
          caption: payload.content.caption,
          filename: payload.content.filename,
        };
        break;
      case 'location':
        base.location = {
          latitude: payload.content.latitude,
          longitude: payload.content.longitude,
          name: payload.content.name,
          address: payload.content.address,
        };
        break;
      case 'interactive':
        base.interactive = payload.content;
        break;
      case 'reaction':
        base.reaction = {
          message_id: payload.content.messageId,
          emoji: payload.content.emoji,
        };
        break;
      default:
        base.text = { body: payload.content.body || payload.content.text };
    }

    return base;
  }
}
