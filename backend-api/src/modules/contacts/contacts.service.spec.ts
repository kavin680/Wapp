import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ContactsService } from './contacts.service';
import { PrismaService } from '../../database/prisma.service';

describe('ContactsService', () => {
  let service: ContactsService;

  const mockPrisma = {
    contact: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated contacts', async () => {
      const contacts = [
        { id: '1', phoneNumber: '+1234567890', userId: 'user-1' },
      ];
      mockPrisma.contact.findMany.mockResolvedValue(contacts);
      mockPrisma.contact.count.mockResolvedValue(1);

      const result = await service.findAll('user-1', { page: 1, limit: 10 });

      expect(result.data).toEqual(contacts);
      expect(result.meta.total).toBe(1);
    });
  });

  describe('findOne', () => {
    it('should return a contact', async () => {
      const contact = { id: '1', phoneNumber: '+1234567890', userId: 'user-1' };
      mockPrisma.contact.findFirst.mockResolvedValue(contact);

      const result = await service.findOne('1', 'user-1');
      expect(result).toEqual(contact);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrisma.contact.findFirst.mockResolvedValue(null);

      await expect(service.findOne('1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a contact', async () => {
      const dto = {
        phoneNumber: '+1234567890',
        firstName: 'John',
        lastName: 'Doe',
      };
      const created = { id: '1', ...dto, userId: 'user-1' };
      mockPrisma.contact.create.mockResolvedValue(created);

      const result = await service.create(dto, 'user-1');
      expect(result.phoneNumber).toBe('+1234567890');
    });
  });

  describe('updateOptInStatus', () => {
    it('should update opt-in status', async () => {
      const contact = { id: '1', userId: 'user-1', optInStatus: 'PENDING' };
      mockPrisma.contact.findFirst.mockResolvedValue(contact);
      mockPrisma.contact.update.mockResolvedValue({
        ...contact,
        optInStatus: 'OPTED_IN',
        optInDate: new Date(),
      });

      const result = await service.updateOptInStatus('1', 'user-1', 'OPTED_IN');
      expect(result.optInStatus).toBe('OPTED_IN');
    });
  });

  describe('importContacts', () => {
    it('should import contacts in bulk', async () => {
      const dto = {
        contacts: [
          { phoneNumber: '+111', firstName: 'A' },
          { phoneNumber: '+222', firstName: 'B' },
        ],
      };
      mockPrisma.contact.upsert.mockResolvedValue({ id: '1' });

      const result = await service.importContacts(dto, 'user-1');
      expect(result.imported).toBe(2);
      expect(mockPrisma.contact.upsert).toHaveBeenCalledTimes(2);
    });
  });
});
