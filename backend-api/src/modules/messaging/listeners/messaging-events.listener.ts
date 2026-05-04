import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../../notifications/notifications.service';

@Injectable()
export class MessagingEventsListener {
  private readonly logger = new Logger(MessagingEventsListener.name);

  constructor(private readonly notificationsService: NotificationsService) {}

  @OnEvent('message.processed')
  async handleMessageProcessed(payload: {
    messageId: string;
    userId: string;
    success: boolean;
    error?: string;
  }) {
    if (!payload.success) {
      await this.notificationsService.create({
        userId: payload.userId,
        type: 'MESSAGE_FAILED',
        title: 'Message delivery failed',
        message: `Message ${payload.messageId} failed: ${payload.error || 'Unknown error'}`,
        data: { messageId: payload.messageId },
      });
      this.logger.log(
        `Notification created for failed message ${payload.messageId}`,
      );
    }
  }

  @OnEvent('campaign.completed')
  async handleCampaignCompleted(payload: {
    campaignId: string;
    userId: string;
  }) {
    await this.notificationsService.create({
      userId: payload.userId,
      type: 'CAMPAIGN_COMPLETED',
      title: 'Campaign completed',
      message: `Campaign ${payload.campaignId} has finished processing.`,
      data: { campaignId: payload.campaignId },
    });
    this.logger.log(
      `Notification created for completed campaign ${payload.campaignId}`,
    );
  }

  @OnEvent('campaign.failed')
  async handleCampaignFailed(payload: {
    campaignId: string;
    userId: string;
    error: string;
  }) {
    await this.notificationsService.create({
      userId: payload.userId,
      type: 'CAMPAIGN_FAILED',
      title: 'Campaign failed',
      message: `Campaign ${payload.campaignId} failed: ${payload.error}`,
      data: { campaignId: payload.campaignId },
    });
  }

  @OnEvent('message.incoming')
  async handleIncomingMessage(payload: {
    userId: string;
    contactName: string;
    conversationId: string;
  }) {
    await this.notificationsService.create({
      userId: payload.userId,
      type: 'NEW_MESSAGE',
      title: 'New incoming message',
      message: `New message from ${payload.contactName || 'Unknown contact'}`,
      data: { conversationId: payload.conversationId },
    });
  }
}
