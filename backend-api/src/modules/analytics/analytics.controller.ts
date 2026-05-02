import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { QueryAnalyticsDto } from './dto';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get analytics dashboard' })
  getDashboard(
    @CurrentUser('sub') userId: string,
    @Query() query: QueryAnalyticsDto,
  ) {
    return this.analyticsService.getDashboard(userId, query);
  }

  @Get('messages')
  @ApiOperation({ summary: 'Get message analytics' })
  getMessageStats(
    @CurrentUser('sub') userId: string,
    @Query() query: QueryAnalyticsDto,
  ) {
    const dateRange = {
      start: query.startDate
        ? new Date(query.startDate)
        : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      end: query.endDate ? new Date(query.endDate) : new Date(),
    };
    return this.analyticsService.getMessageStats(userId, dateRange);
  }

  @Get('volume')
  @ApiOperation({ summary: 'Get message volume over time' })
  getMessageVolume(
    @CurrentUser('sub') userId: string,
    @Query() query: QueryAnalyticsDto,
  ) {
    return this.analyticsService.getMessageVolume(userId, query);
  }

  @Get('provider-health')
  @ApiOperation({ summary: 'Get provider health status' })
  getProviderHealth(@CurrentUser('sub') userId: string) {
    return this.analyticsService.getProviderHealth(userId);
  }

  @Get('contacts')
  @ApiOperation({ summary: 'Get contact statistics' })
  getContactStats(@CurrentUser('sub') userId: string) {
    return this.analyticsService.getContactStats(userId);
  }
}
