import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { QueryUsageDto } from './dto';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Billing')
@ApiBearerAuth()
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('usage')
  @ApiOperation({ summary: 'Get usage records' })
  getUsage(@CurrentUser('sub') userId: string, @Query() query: QueryUsageDto) {
    return this.billingService.getUsage(userId, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get billing summary' })
  @ApiQuery({ name: 'periodStart', required: false })
  @ApiQuery({ name: 'periodEnd', required: false })
  getSummary(
    @CurrentUser('sub') userId: string,
    @Query('periodStart') periodStart?: string,
    @Query('periodEnd') periodEnd?: string,
  ) {
    return this.billingService.getSummary(userId, periodStart, periodEnd);
  }

  @Get('by-channel')
  @ApiOperation({ summary: 'Get usage breakdown by channel' })
  getByChannel(@CurrentUser('sub') userId: string) {
    return this.billingService.getUsageByChannel(userId);
  }
}
