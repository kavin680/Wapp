import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dtos';
import {
  buildPaginatedResult,
  buildPrismaQueryOptions,
} from '../../common/utils';
import {
  CreateProviderDto,
  UpdateProviderDto,
  ConfigureProviderDto,
  SendMessageDto,
} from './dto';
import { ProviderRegistryService } from './providers/provider-registry.service';
import * as crypto from 'crypto';
import type { InputJsonValue } from '@prisma/client/runtime/library';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerRegistry: ProviderRegistryService,
  ) {}

  // ─── Provider CRUD ──────────────────────────────────────────────────────────

  async findAllProviders(query: PaginationQueryDto) {
    const { skip, take, orderBy } = buildPrismaQueryOptions(query);

    const [providers, total] = await Promise.all([
      this.prisma.messagingProvider.findMany({
        skip,
        take,
        orderBy,
        include: { _count: { select: { configs: true, messages: true } } },
      }),
      this.prisma.messagingProvider.count(),
    ]);

    return buildPaginatedResult(providers, query, total);
  }

  async findProviderById(id: string) {
    const provider = await this.prisma.messagingProvider.findUnique({
      where: { id },
      include: {
        _count: { select: { configs: true, messages: true, templates: true } },
      },
    });
    if (!provider) throw new NotFoundException('Provider not found');
    return provider;
  }

  async createProvider(dto: CreateProviderDto) {
    return this.prisma.messagingProvider.create({
      data: {
        name: dto.name,
        type: dto.type,
        description: dto.description,
        isActive: dto.isActive ?? false,
        metadata: dto.metadata as InputJsonValue,
      },
    });
  }

  async updateProvider(id: string, dto: UpdateProviderDto) {
    await this.findProviderById(id);
    return this.prisma.messagingProvider.update({
      where: { id },
      data: {
        ...dto,
        metadata: dto.metadata as InputJsonValue,
      },
    });
  }

  async removeProvider(id: string) {
    await this.findProviderById(id);
    return this.prisma.messagingProvider.delete({ where: { id } });
  }

  // ─── Provider Configuration ─────────────────────────────────────────────────

  async configureProvider(
    providerId: string,
    userId: string,
    dto: ConfigureProviderDto,
  ) {
    await this.findProviderById(providerId);

    const webhookSecret = `whsec_${crypto.randomBytes(24).toString('hex')}`;

    return this.prisma.providerConfig.upsert({
      where: { providerId_userId: { providerId, userId } },
      create: {
        providerId,
        userId,
        credentials: dto.credentials as InputJsonValue,
        settings: dto.settings as InputJsonValue,
        isActive: dto.isActive ?? true,
        phoneNumberId: dto.phoneNumberId,
        businessAccountId: dto.businessAccountId,
        webhookSecret,
      },
      update: {
        credentials: dto.credentials as InputJsonValue,
        settings: dto.settings as InputJsonValue,
        isActive: dto.isActive,
        phoneNumberId: dto.phoneNumberId,
        businessAccountId: dto.businessAccountId,
      },
    });
  }

  async getProviderConfig(providerId: string, userId: string) {
    const config = await this.prisma.providerConfig.findUnique({
      where: { providerId_userId: { providerId, userId } },
      include: { provider: true },
    });
    if (!config) throw new NotFoundException('Provider config not found');
    return config;
  }

  async getUserProviderConfigs(userId: string) {
    return this.prisma.providerConfig.findMany({
      where: { userId },
      include: { provider: true },
    });
  }

  // ─── Message Sending ───────────────────────────────────────────────────────

  async sendMessage(dto: SendMessageDto, userId: string) {
    const provider = dto.providerId
      ? await this.findProviderById(dto.providerId)
      : await this.prisma.messagingProvider.findFirst({
          where: { isActive: true },
        });

    if (!provider) {
      throw new BadRequestException('No active messaging provider available');
    }

    if (!this.providerRegistry.has(provider.type)) {
      throw new BadRequestException(
        `Provider type '${provider.type}' is not available`,
      );
    }

    let contact = await this.prisma.contact.findFirst({
      where: { userId, phoneNumber: dto.to },
    });

    if (!contact) {
      contact = await this.prisma.contact.create({
        data: { userId, phoneNumber: dto.to },
      });
    }

    let conversation = await this.prisma.conversation.findFirst({
      where: { userId, contactId: contact.id, channel: 'WHATSAPP' },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          userId,
          contactId: contact.id,
          channel: 'WHATSAPP',
          status: 'OPEN',
        },
      });
    }

    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        userId,
        providerId: provider.id,
        direction: 'OUTBOUND',
        type: dto.type,
        content: dto.content as InputJsonValue,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        metadata: dto.metadata as InputJsonValue,
      },
    });

    if (dto.scheduledAt) {
      this.logger.log(`Message ${message.id} scheduled for ${dto.scheduledAt}`);
      return { message, scheduled: true };
    }

    const providerInstance = this.providerRegistry.get(provider.type);
    const result =
      (dto.type as string) === 'TEMPLATE'
        ? await providerInstance.sendTemplateMessage({
            to: dto.to,
            type: dto.type.toLowerCase(),
            content: dto.content,
            templateName: dto.templateName,
            templateLanguage: dto.templateLanguage,
            templateVariables: dto.templateVariables,
          })
        : await providerInstance.sendMessage({
            to: dto.to,
            type: dto.type.toLowerCase(),
            content: dto.content,
            mediaUrl: dto.mediaUrl,
          });

    const updateData: Record<string, unknown> = {};
    if (result.success) {
      updateData.externalId = result.externalId;
      updateData.sentAt = new Date();
    } else {
      updateData.failedAt = new Date();
      updateData.errorCode = result.errorCode;
      updateData.errorMessage = result.error;
    }

    const updatedMessage = await this.prisma.message.update({
      where: { id: message.id },
      data: updateData,
    });

    await this.prisma.messageStatus.create({
      data: {
        messageId: message.id,
        status: result.success ? 'sent' : 'failed',
        metadata: result.metadata as InputJsonValue,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date() },
    });

    return { message: updatedMessage, result };
  }

  // ─── Webhook Processing ─────────────────────────────────────────────────────

  async verifyWebhook(
    providerType: string,
    mode: string,
    token: string,
    challenge: string,
  ): Promise<string | null> {
    if (!this.providerRegistry.has(providerType)) return null;

    const provider = this.providerRegistry.get(providerType);
    return provider.verifyWebhook({ mode, token, challenge });
  }

  async processIncomingWebhook(
    providerType: string,
    body: Record<string, unknown>,
    signature?: string,
  ) {
    await this.prisma.webhookEvent.create({
      data: {
        provider: providerType,
        eventType: 'incoming',
        payload: body as InputJsonValue,
      },
    });

    if (!this.providerRegistry.has(providerType)) {
      this.logger.warn(`No provider registered for type: ${providerType}`);
      return { processed: 0 };
    }

    const provider = this.providerRegistry.get(providerType);
    const events = await provider.processWebhook(body, signature);

    let processed = 0;
    for (const event of events) {
      try {
        if (event.type === 'status') {
          await this.handleStatusUpdate(event.data as Record<string, unknown>);
        } else if (event.type === 'message') {
          await this.handleIncomingMessage(
            event.data as Record<string, unknown>,
            event.metadata as Record<string, unknown>,
            providerType,
          );
        }
        processed++;
      } catch (error) {
        this.logger.error(
          `Failed to process webhook event: ${(error as Error).message}`,
        );
      }
    }

    return { processed, total: events.length };
  }

  private async handleStatusUpdate(data: Record<string, unknown>) {
    const externalId = data.id as string;
    if (!externalId) return;

    const message = await this.prisma.message.findFirst({
      where: { externalId },
    });
    if (!message) return;

    const status = data.status as string;
    const updateData: Record<string, unknown> = {};

    if (status === 'delivered') updateData.deliveredAt = new Date();
    if (status === 'read') updateData.readAt = new Date();
    if (status === 'failed') {
      updateData.failedAt = new Date();
      const errors = data.errors as Record<string, unknown>[] | undefined;
      if (errors?.[0]) {
        updateData.errorCode = String(errors[0].code);
        updateData.errorMessage = String(errors[0].title);
      }
    }

    if (Object.keys(updateData).length > 0) {
      await this.prisma.message.update({
        where: { id: message.id },
        data: updateData,
      });
    }

    await this.prisma.messageStatus.create({
      data: {
        messageId: message.id,
        status,
        metadata: data as InputJsonValue,
      },
    });
  }

  private async handleIncomingMessage(
    data: Record<string, unknown>,
    metadata: Record<string, unknown>,
    providerType: string,
  ) {
    const from = data.from as string;
    if (!from) return;

    const provider = await this.prisma.messagingProvider.findFirst({
      where: { type: providerType as 'WHATSAPP' },
    });
    if (!provider) return;

    const configs = await this.prisma.providerConfig.findMany({
      where: { providerId: provider.id, isActive: true },
      take: 1,
    });

    if (configs.length === 0) return;
    const config = configs[0];

    let contact = await this.prisma.contact.findFirst({
      where: { userId: config.userId, phoneNumber: from },
    });

    if (!contact) {
      const profile = (
        data.contacts as Record<string, unknown>[] | undefined
      )?.[0]?.profile as Record<string, unknown> | undefined;
      contact = await this.prisma.contact.create({
        data: {
          userId: config.userId,
          phoneNumber: from,
          displayName: profile?.name as string,
        },
      });
    }

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        userId: config.userId,
        contactId: contact.id,
        channel: 'WHATSAPP',
      },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          userId: config.userId,
          contactId: contact.id,
          channel: 'WHATSAPP',
          status: 'OPEN',
        },
      });
    }

    const messageType = (data.type as string)?.toUpperCase() || 'TEXT';

    await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        userId: config.userId,
        providerId: provider.id,
        direction: 'INBOUND',
        type: messageType as 'TEXT',
        content: data as InputJsonValue,
        externalId: data.id as string,
        sentAt: new Date(
          parseInt(data.timestamp as string, 10) * 1000 || Date.now(),
        ),
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        unreadCount: { increment: 1 },
        status: 'OPEN',
      },
    });
  }
}
