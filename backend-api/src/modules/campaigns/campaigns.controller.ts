import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Patch,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto, UpdateCampaignDto, AddRecipientsDto } from './dto';
import { PaginationQueryDto } from '../../common/dtos';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Campaigns')
@ApiBearerAuth()
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Get()
  @ApiOperation({ summary: 'List campaigns' })
  findAll(
    @CurrentUser('sub') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.campaignsService.findAll(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get campaign by ID' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  findOne(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.campaignsService.findOne(id, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a campaign' })
  create(@Body() dto: CreateCampaignDto, @CurrentUser('sub') userId: string) {
    return this.campaignsService.create(dto, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCampaignDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.campaignsService.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.campaignsService.remove(id, userId);
  }

  @Post(':id/recipients')
  @ApiOperation({ summary: 'Add recipients to campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  addRecipients(
    @Param('id') id: string,
    @Body() dto: AddRecipientsDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.campaignsService.addRecipients(id, userId, dto);
  }

  @Get(':id/recipients')
  @ApiOperation({ summary: 'Get campaign recipients' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  getRecipients(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.campaignsService.getRecipients(id, userId, query);
  }

  @Patch(':id/start')
  @ApiOperation({ summary: 'Start a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  start(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.campaignsService.start(id, userId);
  }

  @Patch(':id/pause')
  @ApiOperation({ summary: 'Pause a running campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  pause(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.campaignsService.pause(id, userId);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  cancel(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.campaignsService.cancel(id, userId);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get campaign statistics' })
  @ApiParam({ name: 'id', description: 'Campaign ID' })
  getStats(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.campaignsService.getStats(id, userId);
  }
}
