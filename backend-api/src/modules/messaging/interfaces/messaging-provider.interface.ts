export interface SendMessagePayload {
  to: string;
  type: string;
  content: Record<string, unknown>;
  templateName?: string;
  templateLanguage?: string;
  templateVariables?: Record<string, string>[];
  mediaUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface SendMessageResult {
  success: boolean;
  externalId?: string;
  error?: string;
  errorCode?: string;
  metadata?: Record<string, unknown>;
}

export interface TemplatePayload {
  name: string;
  language: string;
  category: string;
  components: Record<string, unknown>[];
}

export interface TemplateResult {
  success: boolean;
  externalId?: string;
  status?: string;
  error?: string;
}

export interface WebhookVerification {
  mode: string;
  token: string;
  challenge: string;
}

export interface IMessagingProvider {
  readonly providerType: string;

  sendMessage(payload: SendMessagePayload): Promise<SendMessageResult>;

  sendTemplateMessage(payload: SendMessagePayload): Promise<SendMessageResult>;

  createTemplate(payload: TemplatePayload): Promise<TemplateResult>;

  deleteTemplate(name: string): Promise<{ success: boolean; error?: string }>;

  verifyWebhook(verification: WebhookVerification): string | null;

  processWebhook(
    body: Record<string, unknown>,
    signature?: string,
  ): Promise<Record<string, unknown>[]>;

  getMessageStatus(
    externalId: string,
  ): Promise<{ status: string; metadata?: Record<string, unknown> }>;
}
