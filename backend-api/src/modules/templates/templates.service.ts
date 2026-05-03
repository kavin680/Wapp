import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dtos';
import {
  buildPaginatedResult,
  buildPrismaQueryOptions,
} from '../../common/utils';
import { CreateTemplateDto, UpdateTemplateDto } from './dto';
import { ProviderRegistryService } from '../messaging/providers/provider-registry.service';
import type { InputJsonValue } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly providerRegistry: ProviderRegistryService,
  ) {}

  async findAll(query: PaginationQueryDto, providerId?: string) {
    const { skip, take, orderBy } = buildPrismaQueryOptions(query);

    const where: Prisma.TemplateWhereInput = {};
    if (providerId) where.providerId = providerId;

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { bodyContent: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [templates, total] = await Promise.all([
      this.prisma.template.findMany({
        where,
        skip,
        take,
        orderBy,
        include: { provider: { select: { id: true, name: true, type: true } } },
      }),
      this.prisma.template.count({ where }),
    ]);

    return buildPaginatedResult(templates, query, total);
  }

  async findOne(id: string) {
    const template = await this.prisma.template.findUnique({
      where: { id },
      include: { provider: { select: { id: true, name: true, type: true } } },
    });
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  async create(dto: CreateTemplateDto) {
    return this.prisma.template.create({
      data: {
        providerId: dto.providerId,
        name: dto.name,
        language: dto.language || 'en',
        category: dto.category || 'MARKETING',
        channel: dto.channel || 'WHATSAPP',
        status: 'DRAFT',
        headerType: dto.headerType,
        headerContent: dto.headerContent as InputJsonValue,
        bodyContent: dto.bodyContent,
        footerContent: dto.footerContent,
        buttons: dto.buttons as InputJsonValue,
        variables: dto.variables as InputJsonValue,
        metadata: dto.metadata as InputJsonValue,
      },
    });
  }

  async update(id: string, dto: UpdateTemplateDto) {
    await this.findOne(id);
    const data: Record<string, unknown> = { ...dto };
    if (dto.headerContent) data.headerContent = dto.headerContent;
    if (dto.buttons) data.buttons = dto.buttons;
    if (dto.variables) data.variables = dto.variables;
    if (dto.metadata) data.metadata = dto.metadata;
    return this.prisma.template.update({ where: { id }, data });
  }

  async remove(id: string) {
    const template = await this.findOne(id);

    if (template.externalId) {
      const provider = await this.prisma.messagingProvider.findUnique({
        where: { id: template.providerId },
      });
      if (provider && this.providerRegistry.has(provider.type)) {
        const providerInstance = this.providerRegistry.get(provider.type);
        await providerInstance.deleteTemplate(template.name);
      }
    }

    return this.prisma.template.delete({ where: { id } });
  }

  async submitForApproval(id: string) {
    const template = await this.findOne(id);
    const provider = await this.prisma.messagingProvider.findUnique({
      where: { id: template.providerId },
    });

    if (provider && this.providerRegistry.has(provider.type)) {
      const providerInstance = this.providerRegistry.get(provider.type);
      const components: Record<string, unknown>[] = [];

      if (template.headerType && template.headerContent) {
        components.push({
          type: 'HEADER',
          format: template.headerType,
          ...(template.headerContent as Record<string, unknown>),
        });
      }

      components.push({
        type: 'BODY',
        text: template.bodyContent,
      });

      if (template.footerContent) {
        components.push({ type: 'FOOTER', text: template.footerContent });
      }

      if (template.buttons) {
        components.push({
          type: 'BUTTONS',
          buttons: template.buttons,
        });
      }

      const result = await providerInstance.createTemplate({
        name: template.name,
        language: template.language,
        category: template.category,
        components,
      });

      if (result.success) {
        return this.prisma.template.update({
          where: { id },
          data: {
            status: 'PENDING_APPROVAL',
            externalId: result.externalId,
          },
        });
      }

      return this.prisma.template.update({
        where: { id },
        data: {
          status: 'REJECTED',
          rejectionReason: result.error,
        },
      });
    }

    return this.prisma.template.update({
      where: { id },
      data: { status: 'PENDING_APPROVAL' },
    });
  }
}
