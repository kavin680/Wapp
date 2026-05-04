import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { DatabaseModule } from '../../database';
import messagingConfig from '../../config/messaging.config';
import { MessagingService } from './messaging.service';
import { MessagingController } from './messaging.controller';
import { ProviderRegistryService } from './providers/provider-registry.service';
import { WhatsAppProvider } from './providers/whatsapp';
import {
  MessageProcessor,
  CampaignProcessor,
  MESSAGE_QUEUE,
  CAMPAIGN_QUEUE,
} from './queues';
import { MessagingEventsListener } from './listeners/messaging-events.listener';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    DatabaseModule,
    ConfigModule.forFeature(messagingConfig),
    NotificationsModule,
    BullModule.registerQueueAsync({
      name: MESSAGE_QUEUE,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host', 'localhost'),
          port: configService.get<number>('redis.port', 6379),
          password: configService.get<string>('redis.password'),
          lazyConnect: !configService.get<boolean>('queue.enabled', false),
          maxRetriesPerRequest: configService.get<boolean>(
            'queue.enabled',
            false,
          )
            ? 3
            : 0,
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: configService.get<number>('messaging.retry.maxAttempts', 3),
          backoff: {
            type: 'exponential',
            delay: configService.get<number>('messaging.retry.backoffMs', 1000),
          },
        },
      }),
      inject: [ConfigService],
    }),
    BullModule.registerQueueAsync({
      name: CAMPAIGN_QUEUE,
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: {
          host: configService.get<string>('redis.host', 'localhost'),
          port: configService.get<number>('redis.port', 6379),
          password: configService.get<string>('redis.password'),
          lazyConnect: !configService.get<boolean>('queue.enabled', false),
          maxRetriesPerRequest: configService.get<boolean>(
            'queue.enabled',
            false,
          )
            ? 3
            : 0,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [MessagingController],
  providers: [
    MessagingService,
    ProviderRegistryService,
    WhatsAppProvider,
    MessageProcessor,
    CampaignProcessor,
    MessagingEventsListener,
  ],
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
