import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateSettingDto,
  UpdateSettingDto,
  SetUserPreferenceDto,
} from './dto';
import type { InputJsonValue } from '@prisma/client/runtime/library';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── System Settings ────────────────────────────────────────────────────────

  async findAll(category?: string) {
    const where = category ? { category } : {};
    return this.prisma.systemSetting.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  async findPublic(category?: string) {
    const where: Record<string, unknown> = { isPublic: true };
    if (category) where.category = category;
    return this.prisma.systemSetting.findMany({
      where,
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  async findOne(category: string, key: string) {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { category_key: { category, key } },
    });
    if (!setting) throw new NotFoundException('Setting not found');
    return setting;
  }

  async getValue(category: string, key: string, defaultValue?: unknown) {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { category_key: { category, key } },
    });
    return setting ? setting.value : defaultValue;
  }

  async create(dto: CreateSettingDto) {
    return this.prisma.systemSetting.create({
      data: {
        category: dto.category,
        key: dto.key,
        value: dto.value as InputJsonValue,
        description: dto.description,
        isPublic: dto.isPublic ?? false,
      },
    });
  }

  async update(category: string, key: string, dto: UpdateSettingDto) {
    await this.findOne(category, key);
    return this.prisma.systemSetting.update({
      where: { category_key: { category, key } },
      data: {
        value: dto.value as InputJsonValue,
        description: dto.description,
        isPublic: dto.isPublic,
      },
    });
  }

  async remove(category: string, key: string) {
    await this.findOne(category, key);
    return this.prisma.systemSetting.delete({
      where: { category_key: { category, key } },
    });
  }

  // ─── User Preferences ──────────────────────────────────────────────────────

  async getUserPreferences(userId: string) {
    return this.prisma.userPreference.findMany({
      where: { userId },
      orderBy: { key: 'asc' },
    });
  }

  async getUserPreference(userId: string, key: string) {
    const pref = await this.prisma.userPreference.findUnique({
      where: { userId_key: { userId, key } },
    });
    if (!pref) throw new NotFoundException('Preference not found');
    return pref;
  }

  async setUserPreference(userId: string, dto: SetUserPreferenceDto) {
    return this.prisma.userPreference.upsert({
      where: { userId_key: { userId, key: dto.key } },
      create: {
        userId,
        key: dto.key,
        value: dto.value as InputJsonValue,
      },
      update: {
        value: dto.value as InputJsonValue,
      },
    });
  }

  async deleteUserPreference(userId: string, key: string) {
    await this.getUserPreference(userId, key);
    return this.prisma.userPreference.delete({
      where: { userId_key: { userId, key } },
    });
  }
}
