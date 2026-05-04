import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { StorageService } from '../../common/services';
import { PaginationQueryDto } from '../../common/dtos';
import {
  buildPaginatedResult,
  buildPrismaQueryOptions,
} from '../../common/utils';
import type { MediaType } from '@prisma/client';

export interface UploadMediaParams {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
  ) {}

  async upload(file: UploadMediaParams, type: string, messageId?: string) {
    const result = this.storageService.store({
      buffer: file.buffer,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
    });

    const asset = await this.prisma.mediaAsset.create({
      data: {
        type: type as MediaType,
        url: result.storageKey,
        mimeType: file.mimetype,
        size: file.size,
        filename: file.originalname,
        messageId: messageId || null,
      },
    });

    this.logger.log(`Media uploaded: ${file.originalname} -> ${asset.id}`);
    return asset;
  }

  async findAll(query: PaginationQueryDto) {
    const { skip, take, orderBy } = buildPrismaQueryOptions(query);

    const [assets, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        skip,
        take,
        orderBy,
        include: {
          message: {
            select: { id: true, conversationId: true, direction: true },
          },
        },
      }),
      this.prisma.mediaAsset.count(),
    ]);

    return buildPaginatedResult(assets, query, total);
  }

  async findOne(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({
      where: { id },
      include: {
        message: {
          select: { id: true, conversationId: true, direction: true },
        },
      },
    });
    if (!asset) throw new NotFoundException('Media asset not found');
    return asset;
  }

  async findByMessage(messageId: string) {
    return this.prisma.mediaAsset.findMany({
      where: { messageId },
    });
  }

  async remove(id: string) {
    const asset = await this.findOne(id);
    this.storageService.delete(asset.url);
    await this.prisma.mediaAsset.delete({ where: { id } });
    this.logger.log(`Media deleted: ${id}`);
    return asset;
  }
}
