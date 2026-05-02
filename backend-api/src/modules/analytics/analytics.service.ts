import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { QueryAnalyticsDto } from './dto';
import type { Prisma } from '@prisma/client';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(userId: string, query: QueryAnalyticsDto) {
    const dateRange = this.getDateRange(query);

    const [
      messageStats,
      conversationStats,
      campaignStats,
      contactStats,
      recentActivity,
    ] = await Promise.all([
      this.getMessageStats(userId, dateRange),
      this.getConversationStats(userId, dateRange),
      this.getCampaignStats(userId, dateRange),
      this.getContactStats(userId),
      this.getRecentActivity(userId),
    ]);

    return {
      messages: messageStats,
      conversations: conversationStats,
      campaigns: campaignStats,
      contacts: contactStats,
      recentActivity,
      period: query.period || 'month',
      dateRange,
    };
  }

  async getMessageStats(userId: string, dateRange: { start: Date; end: Date }) {
    const where: Prisma.MessageWhereInput = {
      userId,
      createdAt: { gte: dateRange.start, lte: dateRange.end },
    };

    const [total, sent, delivered, read, failed, inbound, outbound] =
      await Promise.all([
        this.prisma.message.count({ where }),
        this.prisma.message.count({
          where: { ...where, sentAt: { not: null } },
        }),
        this.prisma.message.count({
          where: { ...where, deliveredAt: { not: null } },
        }),
        this.prisma.message.count({
          where: { ...where, readAt: { not: null } },
        }),
        this.prisma.message.count({
          where: { ...where, failedAt: { not: null } },
        }),
        this.prisma.message.count({
          where: { ...where, direction: 'INBOUND' },
        }),
        this.prisma.message.count({
          where: { ...where, direction: 'OUTBOUND' },
        }),
      ]);

    return {
      total,
      sent,
      delivered,
      read,
      failed,
      inbound,
      outbound,
      deliveryRate: sent > 0 ? ((delivered / sent) * 100).toFixed(2) : '0',
      readRate: delivered > 0 ? ((read / delivered) * 100).toFixed(2) : '0',
      failureRate: total > 0 ? ((failed / total) * 100).toFixed(2) : '0',
    };
  }

  async getConversationStats(
    userId: string,
    dateRange: { start: Date; end: Date },
  ) {
    const where: Prisma.ConversationWhereInput = {
      userId,
      createdAt: { gte: dateRange.start, lte: dateRange.end },
    };

    const [total, open, closed, archived] = await Promise.all([
      this.prisma.conversation.count({ where }),
      this.prisma.conversation.count({
        where: { userId, status: 'OPEN' },
      }),
      this.prisma.conversation.count({
        where: { ...where, status: 'CLOSED' },
      }),
      this.prisma.conversation.count({
        where: { userId, status: 'ARCHIVED' },
      }),
    ]);

    return { total, open, closed, archived };
  }

  async getCampaignStats(
    userId: string,
    dateRange: { start: Date; end: Date },
  ) {
    const where: Prisma.CampaignWhereInput = {
      userId,
      createdAt: { gte: dateRange.start, lte: dateRange.end },
    };

    const stats = await this.prisma.campaign.groupBy({
      by: ['status'],
      where,
      _count: true,
    });

    const totals = await this.prisma.campaign.aggregate({
      where,
      _sum: {
        totalRecipients: true,
        sentCount: true,
        deliveredCount: true,
        readCount: true,
        failedCount: true,
      },
    });

    return {
      byStatus: stats.reduce(
        (acc, s) => {
          acc[s.status.toLowerCase()] = s._count;
          return acc;
        },
        {} as Record<string, number>,
      ),
      totals: {
        recipients: totals._sum.totalRecipients || 0,
        sent: totals._sum.sentCount || 0,
        delivered: totals._sum.deliveredCount || 0,
        read: totals._sum.readCount || 0,
        failed: totals._sum.failedCount || 0,
      },
    };
  }

  async getContactStats(userId: string) {
    const [total, optedIn, optedOut, pending] = await Promise.all([
      this.prisma.contact.count({ where: { userId, deletedAt: null } }),
      this.prisma.contact.count({
        where: { userId, optInStatus: 'OPTED_IN', deletedAt: null },
      }),
      this.prisma.contact.count({
        where: { userId, optInStatus: 'OPTED_OUT', deletedAt: null },
      }),
      this.prisma.contact.count({
        where: { userId, optInStatus: 'PENDING', deletedAt: null },
      }),
    ]);

    return { total, optedIn, optedOut, pending };
  }

  async getRecentActivity(userId: string) {
    const messages = await this.prisma.message.findMany({
      where: { userId },
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        direction: true,
        type: true,
        createdAt: true,
        sentAt: true,
        deliveredAt: true,
        failedAt: true,
        conversation: {
          select: {
            contact: {
              select: { phoneNumber: true, displayName: true },
            },
          },
        },
      },
    });

    return messages;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getProviderHealth(_userId: string) {
    const providers = await this.prisma.messagingProvider.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { messages: true } },
      },
    });

    const health = await Promise.all(
      providers.map(async (provider) => {
        const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [sent, failed] = await Promise.all([
          this.prisma.message.count({
            where: {
              providerId: provider.id,
              createdAt: { gte: last24h },
              sentAt: { not: null },
            },
          }),
          this.prisma.message.count({
            where: {
              providerId: provider.id,
              createdAt: { gte: last24h },
              failedAt: { not: null },
            },
          }),
        ]);

        return {
          id: provider.id,
          name: provider.name,
          type: provider.type,
          isActive: provider.isActive,
          totalMessages: provider._count.messages,
          last24h: {
            sent,
            failed,
            successRate:
              sent + failed > 0
                ? ((sent / (sent + failed)) * 100).toFixed(2)
                : '100',
          },
        };
      }),
    );

    return health;
  }

  async getMessageVolume(userId: string, query: QueryAnalyticsDto) {
    const dateRange = this.getDateRange(query);

    const messages = await this.prisma.message.findMany({
      where: {
        userId,
        createdAt: { gte: dateRange.start, lte: dateRange.end },
      },
      select: { createdAt: true, direction: true },
      orderBy: { createdAt: 'asc' },
    });

    const volumeByDay = new Map<
      string,
      { inbound: number; outbound: number }
    >();
    for (const msg of messages) {
      const day = msg.createdAt.toISOString().split('T')[0];
      const existing = volumeByDay.get(day) || { inbound: 0, outbound: 0 };
      if (msg.direction === 'INBOUND') existing.inbound++;
      else existing.outbound++;
      volumeByDay.set(day, existing);
    }

    return Array.from(volumeByDay.entries()).map(([date, counts]) => ({
      date,
      ...counts,
      total: counts.inbound + counts.outbound,
    }));
  }

  private getDateRange(query: QueryAnalyticsDto): {
    start: Date;
    end: Date;
  } {
    const end = query.endDate ? new Date(query.endDate) : new Date();
    let start: Date;

    switch (query.period as string) {
      case 'today':
        start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
        break;
      case 'week':
        start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'quarter':
        start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        start = new Date(end.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        start = query.startDate
          ? new Date(query.startDate)
          : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { start, end };
  }
}
