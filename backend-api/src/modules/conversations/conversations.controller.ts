import { Controller, Get, Patch, Param, Query, Body } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { ConversationsService } from './conversations.service';
import { QueryConversationsDto } from './dto';
import { PaginationQueryDto } from '../../common/dtos';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Conversations')
@ApiBearerAuth()
@Controller('conversations')
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  @ApiOperation({ summary: 'List conversations (inbox)' })
  findAll(
    @CurrentUser('sub') userId: string,
    @Query() query: QueryConversationsDto,
  ) {
    return this.conversationsService.findAll(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get conversation by ID' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  findOne(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.conversationsService.findOne(id, userId);
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Get messages for a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  getMessages(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.conversationsService.getMessages(id, userId, query);
  }

  @Patch(':id/close')
  @ApiOperation({ summary: 'Close a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  close(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.conversationsService.close(id, userId);
  }

  @Patch(':id/reopen')
  @ApiOperation({ summary: 'Reopen a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  reopen(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.conversationsService.reopen(id, userId);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archive a conversation' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  archive(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.conversationsService.archive(id, userId);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark conversation as read' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  markAsRead(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.conversationsService.markAsRead(id, userId);
  }

  @Patch(':id/assign')
  @ApiOperation({ summary: 'Assign conversation to a user' })
  @ApiParam({ name: 'id', description: 'Conversation ID' })
  assign(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
    @Body('assignedTo') assignedTo: string,
  ) {
    return this.conversationsService.assign(id, userId, assignedTo);
  }
}
