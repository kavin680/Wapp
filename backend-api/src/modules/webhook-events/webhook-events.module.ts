import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database';
import { WebhookEventsService } from './webhook-events.service';
import { WebhookEventsController } from './webhook-events.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [WebhookEventsController],
  providers: [WebhookEventsService],
  exports: [WebhookEventsService],
})
export class WebhookEventsModule {}
