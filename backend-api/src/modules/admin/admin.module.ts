import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AuthModule } from '../auth/auth.module';
import { MessagingModule } from '../messaging/messaging.module';
import { ContactsModule } from '../contacts/contacts.module';
import { ConversationsModule } from '../conversations/conversations.module';
import { TemplatesModule } from '../templates/templates.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { MediaModule } from '../media/media.module';
import { SettingsModule } from '../settings/settings.module';
import { DatabaseModule } from '../../database';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    MessagingModule,
    ContactsModule,
    ConversationsModule,
    TemplatesModule,
    CampaignsModule,
    MediaModule,
    SettingsModule,
  ],
  controllers: [AdminController],
})
export class AdminModule {}
