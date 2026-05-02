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
import { CreateCampaignDto, UpdateCampaignDto, AddRecipientsDto } from './dto';
import { ProviderRegistryService } from '../messaging/providers/provider-registry.service';
import type { InputJsonValue } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerRegistry: ProviderRegistryService,
  ) {}

  async findAll(userId: string, query: PaginationQueryDto) {
    const { skip, take, orderBy } = buildPrismaQueryOptions(query);

    const where: Prisma.CampaignWhereInput = { userId };

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { description: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [campaigns, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          provider: { select: { id: true, name: true, type: true } },
          _count: { select: { recipients: true } },
        },
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return buildPaginatedResult(campaigns, query, total);
  }

  async findOne(id: string, userId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, userId },
      include: {
        provider: { select: { id: true, name: true, type: true } },
        _count: { select: { recipients: true } },
      },
    });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async create(dto: CreateCampaignDto, userId: string) {
    const campaign = await this.prisma.campaign.create({
      data: {
        userId,
        providerId: dto.providerId,
        name: dto.name,
        description: dto.description,
        channel: dto.channel || 'WHATSAPP',
        templateId: dto.templateId,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        metadata: dto.metadata as InputJsonValue,
      },
    });

    if (dto.contactIds?.length) {
      await this.addRecipients(campaign.id, userId, {
        contactIds: dto.contactIds,
        templateId: dto.templateId,
      });
    }

    return this.findOne(campaign.id, userId);
  }

  async update(id: string, userId: string, dto: UpdateCampaignDto) {
    const campaign = await this.findOne(id, userId);
    if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
      throw new BadRequestException(
        'Can only update campaigns in DRAFT or SCHEDULED status',
      );
    }

    return this.prisma.campaign.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        templateId: dto.templateId,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
        metadata: dto.metadata as InputJsonValue,
      },
    });
  }

  async remove(id: string, userId: string) {
    const campaign = await this.findOne(id, userId);
    if (campaign.status === 'RUNNING') {
      throw new BadRequestException('Cannot delete a running campaign');
    }
    return this.prisma.campaign.delete({ where: { id } });
  }

  async addRecipients(
    campaignId: string,
    userId: string,
    dto: AddRecipientsDto,
  ) {
    await this.findOne(campaignId, userId);

    const created = await Promise.all(
      dto.contactIds.map((contactId) =>
        this.prisma.campaignRecipient
          .create({
            data: {
              campaignId,
              contactId,
              templateId: dto.templateId,
              variables: dto.variables as InputJsonValue,
            },
          })
          .catch(() => null),
      ),
    );

    const count = created.filter(Boolean).length;

    await this.prisma.campaign.update({
      where: { id: campaignId },
      data: { totalRecipients: { increment: count } },
    });

    return { added: count, skipped: dto.contactIds.length - count };
  }

  async getRecipients(
    campaignId: string,
    userId: string,
    query: PaginationQueryDto,
  ) {
    await this.findOne(campaignId, userId);
    const { skip, take, orderBy } = buildPrismaQueryOptions(query);

    const [recipients, total] = await Promise.all([
      this.prisma.campaignRecipient.findMany({
        where: { campaignId },
        skip,
        take,
        orderBy,
        include: {
          contact: {
            select: {
              id: true,
              phoneNumber: true,
              displayName: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      }),
      this.prisma.campaignRecipient.count({ where: { campaignId } }),
    ]);

    return buildPaginatedResult(recipients, query, total);
  }

  async start(id: string, userId: string) {
    const campaign = await this.findOne(id, userId);
    if (campaign.status !== 'DRAFT' && campaign.status !== 'SCHEDULED') {
      throw new BadRequestException('Campaign cannot be started');
    }

    const provider = await this.prisma.messagingProvider.findUnique({
      where: { id: campaign.providerId },
    });
    if (!provider || !this.providerRegistry.has(provider.type)) {
      throw new BadRequestException('Provider not available');
    }

    await this.prisma.campaign.update({
      where: { id },
      data: { status: 'RUNNING', startedAt: new Date() },
    });

    void this.executeCampaign(id, userId);

    return { status: 'RUNNING', message: 'Campaign started' };
  }

  async pause(id: string, userId: string) {
    const campaign = await this.findOne(id, userId);
    if (campaign.status !== 'RUNNING') {
      throw new BadRequestException('Only running campaigns can be paused');
    }
    return this.prisma.campaign.update({
      where: { id },
      data: { status: 'PAUSED' },
    });
  }

  async cancel(id: string, userId: string) {
    const campaign = await this.findOne(id, userId);
    if (campaign.status === 'COMPLETED' || campaign.status === 'CANCELLED') {
      throw new BadRequestException('Campaign already ended');
    }
    return this.prisma.campaign.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });
  }

  async getStats(id: string, userId: string) {
    await this.findOne(id, userId);

    const stats = await this.prisma.campaignRecipient.groupBy({
      by: ['status'],
      where: { campaignId: id },
      _count: true,
    });

    return stats.reduce(
      (acc, s) => {
        acc[s.status.toLowerCase()] = s._count;
        return acc;
      },
      {} as Record<string, number>,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async executeCampaign(campaignId: string, _userId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      include: { provider: true },
    });
    if (!campaign) return;

    const providerInstance = this.providerRegistry.get(campaign.provider.type);
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
        skip: 0,
        include: {
          contact: { select: { phoneNumber: true } },
          template: true,
        },
      });

      if (recipients.length === 0) break;

      for (const recipient of recipients) {
        try {
          const template = recipient.template;
          const result = template
            ? await providerInstance.sendTemplateMessage({
                to: recipient.contact.phoneNumber,
                type: 'template',
                content: {},
                templateName: template.name,
                templateLanguage: template.language,
                templateVariables: recipient.variables
                  ? Object.entries(
                      recipient.variables as Record<string, string>,
                    ).map(([k, v]) => ({ [k]: v }))
                  : undefined,
              })
            : await providerInstance.sendMessage({
                to: recipient.contact.phoneNumber,
                type: 'text',
                content: {
                  body: campaign.metadata
                    ? (campaign.metadata as Record<string, unknown>).message
                    : '',
                },
              });

          await this.prisma.campaignRecipient.update({
            where: { id: recipient.id },
            data: {
              status: result.success ? 'SENT' : 'FAILED',
              sentAt: result.success ? new Date() : undefined,
              failedAt: result.success ? undefined : new Date(),
              externalMessageId: result.externalId,
              errorMessage: result.error,
            },
          });

          const field = result.success ? 'sentCount' : 'failedCount';
          await this.prisma.campaign.update({
            where: { id: campaignId },
            data: { [field]: { increment: 1 } },
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

    this.logger.log(`Campaign ${campaignId} completed`);
  }
}
