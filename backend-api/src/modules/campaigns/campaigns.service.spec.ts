import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { PrismaService } from '../../database/prisma.service';
import { ProviderRegistryService } from '../messaging/providers/provider-registry.service';

describe('CampaignsService', () => {
  let service: CampaignsService;

  const mockPrisma = {
    campaign: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    campaignRecipient: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    messagingProvider: {
      findUnique: jest.fn(),
    },
  };

  const mockRegistry = {
    has: jest.fn().mockReturnValue(true),
    get: jest.fn().mockReturnValue({
      sendMessage: jest
        .fn()
        .mockResolvedValue({ success: true, externalId: 'x' }),
      sendTemplateMessage: jest
        .fn()
        .mockResolvedValue({ success: true, externalId: 'x' }),
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CampaignsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProviderRegistryService, useValue: mockRegistry },
      ],
    }).compile();

    service = module.get<CampaignsService>(CampaignsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated campaigns', async () => {
      const campaigns = [{ id: '1', name: 'Test', userId: 'user-1' }];
      mockPrisma.campaign.findMany.mockResolvedValue(campaigns);
      mockPrisma.campaign.count.mockResolvedValue(1);

      const result = await service.findAll('user-1', { page: 1, limit: 10 });
      expect(result.data).toEqual(campaigns);
    });
  });

  describe('findOne', () => {
    it('should return a campaign', async () => {
      const campaign = {
        id: '1',
        name: 'Test',
        userId: 'user-1',
        provider: {},
      };
      mockPrisma.campaign.findFirst.mockResolvedValue(campaign);

      const result = await service.findOne('1', 'user-1');
      expect(result).toEqual(campaign);
    });

    it('should throw NotFoundException', async () => {
      mockPrisma.campaign.findFirst.mockResolvedValue(null);

      await expect(service.findOne('1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a campaign', async () => {
      const dto = {
        providerId: 'prov-1',
        name: 'Summer Sale',
        channel: 'WHATSAPP',
      };
      const created = { id: '1', ...dto, userId: 'user-1', status: 'DRAFT' };
      mockPrisma.campaign.create.mockResolvedValue(created);
      mockPrisma.campaign.findFirst.mockResolvedValue(created);

      const result = await service.create(dto, 'user-1');
      expect(result.name).toBe('Summer Sale');
    });
  });

  describe('pause', () => {
    it('should pause a running campaign', async () => {
      const campaign = { id: '1', status: 'RUNNING', userId: 'user-1' };
      mockPrisma.campaign.findFirst.mockResolvedValue(campaign);
      mockPrisma.campaign.update.mockResolvedValue({
        ...campaign,
        status: 'PAUSED',
      });

      const result = await service.pause('1', 'user-1');
      expect(result.status).toBe('PAUSED');
    });

    it('should throw if campaign is not running', async () => {
      const campaign = { id: '1', status: 'DRAFT', userId: 'user-1' };
      mockPrisma.campaign.findFirst.mockResolvedValue(campaign);

      await expect(service.pause('1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('cancel', () => {
    it('should cancel an active campaign', async () => {
      const campaign = { id: '1', status: 'RUNNING', userId: 'user-1' };
      mockPrisma.campaign.findFirst.mockResolvedValue(campaign);
      mockPrisma.campaign.update.mockResolvedValue({
        ...campaign,
        status: 'CANCELLED',
      });

      const result = await service.cancel('1', 'user-1');
      expect(result.status).toBe('CANCELLED');
    });

    it('should throw if campaign already ended', async () => {
      const campaign = { id: '1', status: 'COMPLETED', userId: 'user-1' };
      mockPrisma.campaign.findFirst.mockResolvedValue(campaign);

      await expect(service.cancel('1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getStats', () => {
    it('should return campaign stats', async () => {
      mockPrisma.campaign.findFirst.mockResolvedValue({
        id: '1',
        userId: 'user-1',
      });
      mockPrisma.campaignRecipient.groupBy.mockResolvedValue([
        { status: 'SENT', _count: 5 },
        { status: 'FAILED', _count: 1 },
      ]);

      const result = await service.getStats('1', 'user-1');
      expect(result.sent).toBe(5);
      expect(result.failed).toBe(1);
    });
  });
});
