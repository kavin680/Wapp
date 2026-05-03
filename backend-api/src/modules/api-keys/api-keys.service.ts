import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dtos';
import {
  buildPaginatedResult,
  buildPrismaQueryOptions,
} from '../../common/utils';
import { CreateApiKeyDto } from './dto';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeysService {
  private readonly logger = new Logger(ApiKeysService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: PaginationQueryDto) {
    const { skip, take, orderBy } = buildPrismaQueryOptions(query);

    const [keys, total] = await Promise.all([
      this.prisma.apiKey.findMany({
        where: { userId },
        skip,
        take,
        orderBy,
        select: {
          id: true,
          name: true,
          key: true,
          scopes: true,
          isActive: true,
          lastUsedAt: true,
          expiresAt: true,
          createdAt: true,
        },
      }),
      this.prisma.apiKey.count({ where: { userId } }),
    ]);

    const maskedKeys = keys.map((k) => ({
      ...k,
      key: `${k.key.substring(0, 8)}...${k.key.substring(k.key.length - 4)}`,
    }));

    return buildPaginatedResult(maskedKeys, query, total);
  }

  async create(dto: CreateApiKeyDto, userId: string) {
    const rawKey = `wapp_${crypto.randomBytes(32).toString('hex')}`;
    const hashedKey = crypto.createHash('sha256').update(rawKey).digest('hex');

    const apiKey = await this.prisma.apiKey.create({
      data: {
        userId,
        name: dto.name,
        key: rawKey,
        hashedKey,
        scopes: dto.scopes || [],
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      },
    });

    return {
      id: apiKey.id,
      name: apiKey.name,
      key: rawKey,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      note: 'Store this key securely. It will not be shown again.',
    };
  }

  async revoke(id: string, userId: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id, userId },
    });
    if (!key) throw new NotFoundException('API key not found');

    return this.prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async remove(id: string, userId: string) {
    const key = await this.prisma.apiKey.findFirst({
      where: { id, userId },
    });
    if (!key) throw new NotFoundException('API key not found');

    return this.prisma.apiKey.delete({ where: { id } });
  }

  async validateKey(
    rawKey: string,
  ): Promise<{ userId: string; scopes: string[] } | null> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { key: rawKey },
    });

    if (!apiKey || !apiKey.isActive) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return { userId: apiKey.userId, scopes: apiKey.scopes };
  }
}
