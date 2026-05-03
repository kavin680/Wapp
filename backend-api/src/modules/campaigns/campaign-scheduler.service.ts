import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { CampaignsService } from './campaigns.service';

@Injectable()
export class CampaignSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(CampaignSchedulerService.name);
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly checkIntervalMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly campaignsService: CampaignsService,
    private readonly configService: ConfigService,
  ) {
    this.checkIntervalMs = this.configService.get<number>(
      'messaging.campaign.schedulerIntervalMs',
      60000,
    );
  }

  onModuleInit() {
    this.startScheduler();
  }

  private startScheduler() {
    this.logger.log(
      `Campaign scheduler started (interval: ${this.checkIntervalMs}ms)`,
    );
    this.intervalId = setInterval(
      () => void this.checkScheduledCampaigns(),
      this.checkIntervalMs,
    );

    void this.checkScheduledCampaigns();
  }

  stopScheduler() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.logger.log('Campaign scheduler stopped');
    }
  }

  private async checkScheduledCampaigns() {
    try {
      const campaigns = await this.prisma.campaign.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledAt: { lte: new Date() },
        },
      });

      if (campaigns.length === 0) return;

      this.logger.log(
        `Found ${campaigns.length} scheduled campaign(s) ready to execute`,
      );

      for (const campaign of campaigns) {
        try {
          await this.campaignsService.start(campaign.id, campaign.userId);
          this.logger.log(`Started scheduled campaign: ${campaign.id}`);
        } catch (error) {
          this.logger.error(
            `Failed to start scheduled campaign ${campaign.id}: ${(error as Error).message}`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Scheduler error: ${(error as Error).message}`);
    }
  }
}
