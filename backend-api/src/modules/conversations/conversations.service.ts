import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  buildPaginatedResult,
  buildPrismaQueryOptions,
} from '../../common/utils';
import { PaginationQueryDto } from '../../common/dtos';
import { QueryConversationsDto } from './dto';
import type { Prisma } from '@prisma/client';

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: QueryConversationsDto) {
    const { skip, take, orderBy } = buildPrismaQueryOptions(query);

    const where: Prisma.ConversationWhereInput = { userId };
    if (query.status) where.status = query.status;
    if (query.channel) where.channel = query.channel;
    if (query.contactId) where.contactId = query.contactId;

    if (query.search) {
      where.contact = {
        OR: [
          { phoneNumber: { contains: query.search, mode: 'insensitive' } },
          { displayName: { contains: query.search, mode: 'insensitive' } },
          { firstName: { contains: query.search, mode: 'insensitive' } },
        ],
      };
    }

    const [conversations, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        skip,
        take,
        orderBy: orderBy || { lastMessageAt: 'desc' },
        include: {
          contact: {
            select: {
              id: true,
              phoneNumber: true,
              displayName: true,
              firstName: true,
              lastName: true,
              avatarUrl: true,
            },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              type: true,
              content: true,
              direction: true,
              createdAt: true,
            },
          },
          _count: { select: { messages: true } },
        },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    return buildPaginatedResult(conversations, query, total);
  }

  async findOne(id: string, userId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, userId },
      include: {
        contact: true,
        _count: { select: { messages: true } },
      },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');
    return conversation;
  }

  async getMessages(
    conversationId: string,
    userId: string,
    query: PaginationQueryDto,
  ) {
    await this.findOne(conversationId, userId);
    const { skip, take } = buildPrismaQueryOptions(query);

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { conversationId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          statuses: { orderBy: { createdAt: 'desc' }, take: 1 },
          mediaAssets: true,
        },
      }),
      this.prisma.message.count({ where: { conversationId } }),
    ]);

    return buildPaginatedResult(messages, query, total);
  }

  async close(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.conversation.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });
  }

  async reopen(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.conversation.update({
      where: { id },
      data: { status: 'OPEN', closedAt: null },
    });
  }

  async archive(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.conversation.update({
      where: { id },
      data: { status: 'ARCHIVED' },
    });
  }

  async markAsRead(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.conversation.update({
      where: { id },
      data: { unreadCount: 0 },
    });
  }

  async assign(id: string, userId: string, assignedTo: string) {
    await this.findOne(id, userId);
    return this.prisma.conversation.update({
      where: { id },
      data: { assignedTo },
    });
  }
}
