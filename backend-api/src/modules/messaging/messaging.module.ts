import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from '../../database';
import messagingConfig from '../../config/messaging.config';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { ProviderRegistryService } from './providers/provider-registry.service';
import { WhatsAppProvider } from './providers/whatsapp';

@Module({
  imports: [DatabaseModule, ConfigModule.forFeature(messagingConfig)],
  controllers: [MessagingController],
  providers: [MessagingService, ProviderRegistryService, WhatsAppProvider],
  exports: [MessagingService, ProviderRegistryService],
})
export class MessagingModule implements OnModuleInit {
  constructor(
    private readonly registry: ProviderRegistryService,
    private readonly whatsappProvider: WhatsAppProvider,
  ) {}

  onModuleInit() {
    this.registry.register(this.whatsappProvider);
  }
}
