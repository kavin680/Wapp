import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../../../database/prisma.service';
import { ProviderRegistryService } from '../providers/provider-registry.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  CampaignJobData,
  SendMessageJobData,
  MESSAGE_QUEUE,
  CAMPAIGN_QUEUE,
} from './message.processor';

@Processor(CAMPAIGN_QUEUE)
export class CampaignProcessor extends WorkerHost {
  private readonly logger = new Logger(CampaignProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerRegistry: ProviderRegistryService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(MESSAGE_QUEUE) private readonly messageQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<CampaignJobData>): Promise<void> {
    const { campaignId, userId } = job.data;

    this.logger.log(`Processing campaign ${campaignId}`);

    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { provider: true },
    });

    if (!campaign) {
      this.logger.warn(`Campaign ${campaignId} not found`);
      return;
    }

    if (!this.providerRegistry.has(campaign.provider.type)) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { status: 'FAILED' },
      });
      return;
    }

    const batchSize = 50;

    while (true) {
      const currentCampaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
      });
      if (
        !currentCampaign ||
        currentCampaign.status === 'PAUSED' ||
        currentCampaign.status === 'CANCELLED'
      ) {
        break;
      }

      const recipients = await this.prisma.campaignRecipient.findMany({
        where: { campaignId, status: 'PENDING' },
        take: batchSize,
        include: {
          contact: { select: { phoneNumber: true } },
          template: true,
        },
      });

      if (recipients.length === 0) break;

      for (const recipient of recipients) {
        try {
          const template = recipient.template;

          const conversation = await this.findOrCreateConversation(
            userId,
            recipient.contactId,
          );

          const message = await this.prisma.message.create({
            data: {
              conversationId: conversation.id,
              userId,
              providerId: campaign.providerId,
              direction: 'OUTBOUND',
              type: template ? 'TEMPLATE' : 'TEXT',
              content: template
                ? {}
                : {
                    body:
                      (campaign.metadata as Record<string, unknown>)?.message ||
                      '',
                  },
            },
          });

          const jobData: SendMessageJobData = {
            messageId: message.id,
            providerId: campaign.providerId,
            providerType: campaign.provider.type,
            to: recipient.contact.phoneNumber,
            type: template ? 'template' : 'text',
            content: template
              ? {}
              : {
                  body:
                    (campaign.metadata as Record<string, unknown>)?.message ||
                    '',
                },
            templateName: template?.name,
            templateLanguage: template?.language,
            templateVariables: recipient.variables
              ? Object.entries(
                  recipient.variables as Record<string, string>,
                ).map(([k, v]) => ({ [k]: v }))
              : undefined,
            userId,
            conversationId: conversation.id,
          };

          await this.messageQueue.add('send', jobData, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 2000 },
          });

          await this.prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: { status: 'SENT', sentAt: new Date() },
          });

          await this.prisma.campaign.update({
            where: { id: campaignId },
            data: { sentCount: { increment: 1 } },
          });
        } catch (error) {
          await this.prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: 'FAILED',
              failedAt: new Date(),
              errorMessage: (error as Error).message,
            },
          });
          await this.prisma.campaign.update({
            where: { id: campaignId },
            data: { failedCount: { increment: 1 } },
          });
        }
      }
    }

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });

    this.eventEmitter.emit('campaign.completed', { campaignId, userId });
    this.logger.log(`Campaign ${campaignId} completed`);
  }

  private async findOrCreateConversation(userId: string, contactId: string) {
    let conversation = await this.prisma.conversation.findFirst({
      where: { userId, contactId, channel: 'WHATSAPP' },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: { userId, contactId, channel: 'WHATSAPP', status: 'OPEN' },
      });
    }

    return conversation;
  }
}
