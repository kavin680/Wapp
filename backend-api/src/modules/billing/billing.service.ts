import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  buildPaginatedResult,
  buildPrismaQueryOptions,
} from '../../common/utils';
import { QueryUsageDto } from './dto';
import type { InputJsonValue } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async trackUsage(params: {
    userId: string;
    resource: string;
    action: string;
    quantity?: number;
    unitCost?: number;
    channel?: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'TELEGRAM' | 'MESSENGER' | 'SLACK';
    metadata?: Record<string, unknown>;
  }) {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    return this.prisma.billingUsage.create({
      data: {
        userId: params.userId,
        resource: params.resource,
        action: params.action,
        quantity: params.quantity || 1,
        unitCost: params.unitCost,
        totalCost:
          params.unitCost && params.quantity
            ? params.unitCost * params.quantity
            : params.unitCost,
        channel: params.channel,
        metadata: params.metadata as InputJsonValue,
        periodStart,
        periodEnd,
      },
    });
  }

  async getUsage(userId: string, query: QueryUsageDto) {
    const { skip, take, orderBy } = buildPrismaQueryOptions(query);

    const where: Prisma.BillingUsageWhereInput = { userId };
    if (query.resource) where.resource = query.resource;
    if (query.periodStart) {
      where.periodStart = { gte: new Date(query.periodStart) };
    }
    if (query.periodEnd) {
      where.periodEnd = { lte: new Date(query.periodEnd) };
    }

    const [records, total] = await Promise.all([
      this.prisma.billingUsage.findMany({
        where,
        skip,
        take,
        orderBy,
      }),
      this.prisma.billingUsage.count({ where }),
    ]);

    return buildPaginatedResult(records, query, total);
  }

  async getSummary(userId: string, periodStart?: string, periodEnd?: string) {
    const where: Prisma.BillingUsageWhereInput = { userId };
    if (periodStart) where.periodStart = { gte: new Date(periodStart) };
    if (periodEnd) where.periodEnd = { lte: new Date(periodEnd) };

    const summary = await this.prisma.billingUsage.groupBy({
      by: ['resource', 'action'],
      where,
      _sum: { quantity: true, totalCost: true },
      _count: true,
    });

    const totals = await this.prisma.billingUsage.aggregate({
      where,
      _sum: { quantity: true, totalCost: true },
      _count: true,
    });

    return {
      breakdown: summary.map((s) => ({
        resource: s.resource,
        action: s.action,
        totalQuantity: s._sum.quantity,
        totalCost: s._sum.totalCost,
        count: s._count,
      })),
      totals: {
        totalQuantity: totals._sum.quantity,
        totalCost: totals._sum.totalCost,
        totalRecords: totals._count,
      },
    };
  }

  async getUsageByChannel(userId: string) {
    return this.prisma.billingUsage.groupBy({
      by: ['channel'],
      where: { userId },
      _sum: { quantity: true, totalCost: true },
      _count: true,
    });
  }
}
