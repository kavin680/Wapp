import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { CampaignSchedulerService } from './campaign-scheduler.service';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [DatabaseModule, MessagingModule],
  controllers: [CampaignsController],
  providers: [CampaignsService, CampaignSchedulerService],
  exports: [CampaignsService],
})
export class CampaignsModule {}
