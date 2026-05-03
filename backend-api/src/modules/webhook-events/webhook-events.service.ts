import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  buildPaginatedResult,
  buildPrismaQueryOptions,
} from '../../common/utils';
import { QueryWebhookEventsDto } from './dto';
import type { Prisma } from '@prisma/client';

@Injectable()
export class WebhookEventsService {
  private readonly logger = new Logger(WebhookEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: QueryWebhookEventsDto) {
    const { skip, take, orderBy } = buildPrismaQueryOptions(query);

    const where: Prisma.WebhookEventWhereInput = {};
    if (query.provider) where.provider = query.provider;
    if (query.eventType) where.eventType = query.eventType;
    if (query.processed !== undefined) where.processed = query.processed;

    const [events, total] = await Promise.all([
      this.prisma.webhookEvent.findMany({
        where,
        skip,
        take,
        orderBy,
      }),
      this.prisma.webhookEvent.count({ where }),
    ]);

    return buildPaginatedResult(events, query, total);
  }

  async findOne(id: string) {
    const event = await this.prisma.webhookEvent.findUnique({
      where: { id },
    });
    if (!event) throw new NotFoundException('Webhook event not found');
    return event;
  }

  async reprocess(id: string) {
    await this.findOne(id);
    return this.prisma.webhookEvent.update({
      where: { id },
      data: {
        processed: false,
        retryCount: { increment: 1 },
      },
    });
  }

  async getStats() {
    const [total, processed, unprocessed, byProvider] = await Promise.all([
      this.prisma.webhookEvent.count(),
      this.prisma.webhookEvent.count({ where: { processed: true } }),
      this.prisma.webhookEvent.count({ where: { processed: false } }),
      this.prisma.webhookEvent.groupBy({
        by: ['provider'],
        _count: true,
      }),
    ]);

    return {
      total,
      processed,
      unprocessed,
      byProvider: byProvider.map((p) => ({
        provider: p.provider,
        count: p._count,
      })),
    };
  }
}
