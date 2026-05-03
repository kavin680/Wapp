import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PaginationQueryDto } from '../../common/dtos';
import {
  buildPaginatedResult,
  buildPrismaQueryOptions,
} from '../../common/utils';
import { CreateContactDto, UpdateContactDto, ImportContactsDto } from './dto';
import type { InputJsonValue } from '@prisma/client/runtime/library';
import type { Prisma } from '@prisma/client';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: PaginationQueryDto) {
    const { skip, take, orderBy } = buildPrismaQueryOptions(query);

    const where: Prisma.ContactWhereInput = {
      userId,
      deletedAt: null,
    };

    if (query.search) {
      where.OR = [
        { phoneNumber: { contains: query.search, mode: 'insensitive' } },
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { displayName: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [contacts, total] = await Promise.all([
      this.prisma.contact.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          _count: { select: { conversations: true, campaignRecipients: true } },
        },
      }),
      this.prisma.contact.count({ where }),
    ]);

    return buildPaginatedResult(contacts, query, total);
  }

  async findOne(id: string, userId: string) {
    const contact = await this.prisma.contact.findFirst({
      where: { id, userId, deletedAt: null },
      include: {
        conversations: { take: 5, orderBy: { lastMessageAt: 'desc' } },
        _count: { select: { conversations: true, campaignRecipients: true } },
      },
    });
    if (!contact) throw new NotFoundException('Contact not found');
    return contact;
  }

  async create(dto: CreateContactDto, userId: string) {
    return this.prisma.contact.create({
      data: {
        userId,
        phoneNumber: dto.phoneNumber,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        displayName: dto.displayName,
        avatarUrl: dto.avatarUrl,
        country: dto.country,
        tags: dto.tags || [],
        metadata: dto.metadata as InputJsonValue,
        optInStatus: dto.optInStatus || 'PENDING',
        optInDate:
          (dto.optInStatus as string) === 'OPTED_IN' ? new Date() : undefined,
      },
    });
  }

  async update(id: string, userId: string, dto: UpdateContactDto) {
    await this.findOne(id, userId);

    const data: Record<string, unknown> = { ...dto };
    if (dto.metadata) data.metadata = dto.metadata;
    if ((dto.optInStatus as string) === 'OPTED_IN') data.optInDate = new Date();
    if ((dto.optInStatus as string) === 'OPTED_OUT')
      data.optOutDate = new Date();

    return this.prisma.contact.update({ where: { id }, data });
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.contact.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async importContacts(dto: ImportContactsDto, userId: string) {
    const results = { imported: 0, skipped: 0, errors: [] as string[] };

    for (const contactDto of dto.contacts) {
      try {
        await this.prisma.contact.upsert({
          where: {
            userId_phoneNumber: {
              userId,
              phoneNumber: contactDto.phoneNumber,
            },
          },
          create: {
            userId,
            phoneNumber: contactDto.phoneNumber,
            email: contactDto.email,
            firstName: contactDto.firstName,
            lastName: contactDto.lastName,
            displayName: contactDto.displayName,
            country: contactDto.country,
            tags: contactDto.tags || [],
            metadata: contactDto.metadata as InputJsonValue,
            optInStatus: contactDto.optInStatus || 'PENDING',
          },
          update: {
            email: contactDto.email,
            firstName: contactDto.firstName,
            lastName: contactDto.lastName,
            displayName: contactDto.displayName,
            country: contactDto.country,
            tags: contactDto.tags,
            metadata: contactDto.metadata as InputJsonValue,
          },
        });
        results.imported++;
      } catch (error) {
        results.skipped++;
        results.errors.push(
          `${contactDto.phoneNumber}: ${(error as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Imported ${results.imported} contacts, skipped ${results.skipped}`,
    );
    return results;
  }

  async updateOptInStatus(
    id: string,
    userId: string,
    status: 'OPTED_IN' | 'OPTED_OUT',
  ) {
    await this.findOne(id, userId);
    return this.prisma.contact.update({
      where: { id },
      data: {
        optInStatus: status,
        optInDate: status === 'OPTED_IN' ? new Date() : undefined,
        optOutDate: status === 'OPTED_OUT' ? new Date() : undefined,
      },
    });
  }
}
