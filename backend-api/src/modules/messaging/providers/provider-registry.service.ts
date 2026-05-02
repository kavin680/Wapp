import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { IMessagingProvider } from '../interfaces';

@Injectable()
export class ProviderRegistryService {
  private readonly logger = new Logger(ProviderRegistryService.name);
  private readonly providers = new Map<string, IMessagingProvider>();

  register(provider: IMessagingProvider) {
    this.providers.set(provider.providerType, provider);
    this.logger.log(`Registered messaging provider: ${provider.providerType}`);
  }

  get(providerType: string): IMessagingProvider {
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new NotFoundException(
        `Messaging provider '${providerType}' not registered`,
      );
    }
    return provider;
  }

  has(providerType: string): boolean {
    return this.providers.has(providerType);
  }

  getAll(): IMessagingProvider[] {
    return Array.from(this.providers.values());
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.providers.keys());
  }
}
