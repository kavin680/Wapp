import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { WebhookEventsService } from './webhook-events.service';
import { QueryWebhookEventsDto } from './dto';
import { Roles } from '../../common/decorators';
import { Role } from '../../common/enums';

@ApiTags('Webhook Events')
@ApiBearerAuth()
@Controller('webhook-events')
export class WebhookEventsController {
  constructor(private readonly webhookEventsService: WebhookEventsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List webhook events' })
  findAll(@Query() query: QueryWebhookEventsDto) {
    return this.webhookEventsService.findAll(query);
  }

  @Get('stats')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get webhook event statistics' })
  getStats() {
    return this.webhookEventsService.getStats();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get webhook event by ID' })
  @ApiParam({ name: 'id', description: 'Webhook event ID' })
  findOne(@Param('id') id: string) {
    return this.webhookEventsService.findOne(id);
  }

  @Patch(':id/reprocess')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reprocess a webhook event' })
  @ApiParam({ name: 'id', description: 'Webhook event ID' })
  reprocess(@Param('id') id: string) {
    return this.webhookEventsService.reprocess(id);
  }
}
