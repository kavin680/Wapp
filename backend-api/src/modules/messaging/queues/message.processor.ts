import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../database/prisma.service';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import type { InputJsonValue } from '@prisma/client/runtime/library';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface SendMessageJobData {
  messageId: string;
  providerId: string;
  providerType: string;
  to: string;
  type: string;
  content: Record<string, unknown>;
  templateName?: string;
  templateLanguage?: string;
  templateVariables?: Record<string, string>[];
  mediaUrl?: string;
  userId: string;
  conversationId: string;
}

export interface CampaignJobData {
  campaignId: string;
  userId: string;
}

export const MESSAGE_QUEUE = 'messaging';
export const CAMPAIGN_QUEUE = 'campaigns';

@Processor(MESSAGE_QUEUE)
export class MessageProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerRegistry: ProviderRegistryService,
    private readonly eventEmitter: EventEmitter2,
  ) {
    super();
  }

  async process(job: Job<SendMessageJobData>): Promise<void> {
    const { messageId, providerType, to, type, content } = job.data;

    this.logger.log(
      `Processing message ${messageId} (attempt ${job.attemptsMade + 1})`,
    );

    const providerInstance = this.providerRegistry.get(providerType);

    const result =
      type === 'TEMPLATE' || type === 'template'
        ? await providerInstance.sendTemplateMessage({
            to,
            type: type.toLowerCase(),
            content,
            templateName: job.data.templateName,
            templateLanguage: job.data.templateLanguage,
            templateVariables: job.data.templateVariables,
          })
        : await providerInstance.sendMessage({
            to,
            type: type.toLowerCase(),
            content,
            mediaUrl: job.data.mediaUrl,
          });

    const updateData: Record<string, unknown> = {
      retryCount: job.attemptsMade,
    };

    if (result.success) {
      updateData.externalId = result.externalId;
      updateData.sentAt = new Date();
    } else {
      updateData.failedAt = new Date();
      updateData.errorCode = result.errorCode;
      updateData.errorMessage = result.error;
    }

    await this.prisma.message.update({
      where: { id: messageId },
      data: updateData,
    });

    await this.prisma.messageStatus.create({
      data: {
        messageId,
        status: result.success ? 'sent' : 'failed',
        metadata: result.metadata as InputJsonValue,
      },
    });

    await this.prisma.conversation.update({
      where: { id: job.data.conversationId },
      data: { lastMessageAt: new Date() },
    });

    this.eventEmitter.emit('message.processed', {
      messageId,
      userId: job.data.userId,
      success: result.success,
      error: result.error,
    });

    if (!result.success) {
      throw new Error(result.error || 'Message send failed');
    }
  }
}
