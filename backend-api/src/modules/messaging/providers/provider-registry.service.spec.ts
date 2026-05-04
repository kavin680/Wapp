import { NotFoundException } from '@nestjs/common';
import { ProviderRegistryService } from './provider-registry.service';
import type { IMessagingProvider } from '../interfaces';

describe('ProviderRegistryService', () => {
  let registry: ProviderRegistryService;

  const mockProvider: IMessagingProvider = {
    providerType: 'WHATSAPP',
    sendMessage: jest.fn(),
    sendTemplateMessage: jest.fn(),
    createTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
    verifyWebhook: jest.fn(),
    processWebhook: jest.fn(),
    getMessageStatus: jest.fn(),
  };

  beforeEach(() => {
    registry = new ProviderRegistryService();
  });

  it('should register a provider', () => {
    registry.register(mockProvider);
    expect(registry.has('WHATSAPP')).toBe(true);
  });

  it('should get a registered provider', () => {
    registry.register(mockProvider);
    const result = registry.get('WHATSAPP');
    expect(result).toBe(mockProvider);
  });

  it('should throw NotFoundException for unregistered provider', () => {
    expect(() => registry.get('SMS')).toThrow(NotFoundException);
  });

  it('should report has correctly', () => {
    expect(registry.has('WHATSAPP')).toBe(false);
    registry.register(mockProvider);
    expect(registry.has('WHATSAPP')).toBe(true);
  });

  it('should return all providers', () => {
    registry.register(mockProvider);
    expect(registry.getAll()).toHaveLength(1);
  });

  it('should return registered types', () => {
    registry.register(mockProvider);
    expect(registry.getRegisteredTypes()).toEqual(['WHATSAPP']);
  });
});
