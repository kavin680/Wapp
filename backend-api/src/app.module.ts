import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';

// Config
import {
  appConfig,
  authConfig,
  databaseConfig,
  redisConfig,
  mailConfig,
  queueConfig,
  monitoringConfig,
  messagingConfig,
  validate,
} from './config';

// Database
import { DatabaseModule } from './database';

// Common services
import { CommonModule } from './common/services';

// Modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './modules/health/health.module';
import { AuditModule } from './modules/audit/audit.module';
import { MailModule } from './modules/mail/mail.module';
import { CacheConfigModule } from './modules/cache/cache.module';
import { AppLoggerModule } from './modules/logger/logger.module';
import { FeatureFlagsModule } from './modules/feature-flags/feature-flags.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { FileUploadModule } from './modules/file-upload/file-upload.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { ContactsModule } from './modules/contacts/contacts.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { ConversationsModule } from './modules/conversations/conversations.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { BillingModule } from './modules/billing/billing.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ApiKeysModule } from './modules/api-keys/api-keys.module';
import { WebhookEventsModule } from './modules/webhook-events/webhook-events.module';
import { MediaModule } from './modules/media/media.module';

// Common
import { JwtAuthGuard } from './modules/auth/guards';
import { RolesGuard } from './common/guards';
import { GlobalExceptionFilter } from './common/filters';
import { ResponseInterceptor, LoggingInterceptor } from './common/interceptors';
import { RequestIdMiddleware } from './common/middleware';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        authConfig,
        databaseConfig,
        redisConfig,
        mailConfig,
        queueConfig,
        monitoringConfig,
        messagingConfig,
      ],
      envFilePath: ['.env.local', '.env'],
      validate,
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Event emitter
    EventEmitterModule.forRoot(),

    // Infrastructure
    DatabaseModule,
    CommonModule,
    CacheConfigModule.register(),
    AppLoggerModule,
    MailModule,

    // Feature modules
    AuthModule,
    UsersModule,
    HealthModule,
    AuditModule,
    FeatureFlagsModule,
    NotificationsModule,
    WebhooksModule,
    FileUploadModule,

    // Messaging platform modules
    MessagingModule,
    ContactsModule,
    TemplatesModule,
    ConversationsModule,
    CampaignsModule,
    BillingModule,
    AnalyticsModule,
    SettingsModule,
    ApiKeysModule,
    WebhookEventsModule,
    MediaModule,
  ],
  providers: [
    // Global JWT auth guard
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Global roles guard
    { provide: APP_GUARD, useClass: RolesGuard },
    // Global throttler guard
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Global exception filter
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    // Global response interceptor
    { provide: APP_INTERCEPTOR, useClass: ResponseInterceptor },
    // Global logging interceptor
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
