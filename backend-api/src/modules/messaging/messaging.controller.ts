import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  Res,
  Headers,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { MessagingService } from './messaging.service';
import {
  CreateProviderDto,
  UpdateProviderDto,
  ConfigureProviderDto,
  SendMessageDto,
} from './dto';
import { PaginationQueryDto } from '../../common/dtos';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { Role } from '../../common/enums';

@ApiTags('Messaging')
@ApiBearerAuth()
@Controller('messaging')
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  // ─── Provider CRUD (Admin) ────────────────────────────────────────────────

  @Get('providers')
  @ApiOperation({ summary: 'List all messaging providers' })
  findAllProviders(@Query() query: PaginationQueryDto) {
    return this.messagingService.findAllProviders(query);
  }

  @Get('providers/:id')
  @ApiOperation({ summary: 'Get a messaging provider by ID' })
  @ApiParam({ name: 'id', description: 'Provider ID' })
  findProviderById(@Param('id') id: string) {
    return this.messagingService.findProviderById(id);
  }

  @Post('providers')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a messaging provider' })
  createProvider(@Body() dto: CreateProviderDto) {
    return this.messagingService.createProvider(dto);
  }

  @Put('providers/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a messaging provider' })
  @ApiParam({ name: 'id', description: 'Provider ID' })
  updateProvider(@Param('id') id: string, @Body() dto: UpdateProviderDto) {
    return this.messagingService.updateProvider(id, dto);
  }

  @Delete('providers/:id')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a messaging provider' })
  @ApiParam({ name: 'id', description: 'Provider ID' })
  removeProvider(@Param('id') id: string) {
    return this.messagingService.removeProvider(id);
  }

  // ─── Provider Configuration ─────────────────────────────────────────────────

  @Post('providers/:id/configure')
  @ApiOperation({ summary: 'Configure a provider for current user' })
  @ApiParam({ name: 'id', description: 'Provider ID' })
  configureProvider(
    @Param('id') id: string,
    @Body() dto: ConfigureProviderDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.messagingService.configureProvider(id, userId, dto);
  }

  @Get('providers/:id/config')
  @ApiOperation({ summary: 'Get provider config for current user' })
  @ApiParam({ name: 'id', description: 'Provider ID' })
  getProviderConfig(
    @Param('id') id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.messagingService.getProviderConfig(id, userId);
  }

  @Get('my-providers')
  @ApiOperation({ summary: 'Get all configured providers for current user' })
  getMyProviderConfigs(@CurrentUser('sub') userId: string) {
    return this.messagingService.getUserProviderConfigs(userId);
  }

  // ─── Send Messages ─────────────────────────────────────────────────────────

  @Post('send')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send a message' })
  sendMessage(@Body() dto: SendMessageDto, @CurrentUser('sub') userId: string) {
    return this.messagingService.sendMessage(dto, userId);
  }

  // ─── Webhooks ───────────────────────────────────────────────────────────────

  @Get('webhooks/:provider')
  @Public()
  @ApiOperation({ summary: 'Verify webhook (GET challenge)' })
  @ApiParam({ name: 'provider', example: 'WHATSAPP' })
  @ApiQuery({ name: 'hub.mode', required: false })
  @ApiQuery({ name: 'hub.verify_token', required: false })
  @ApiQuery({ name: 'hub.challenge', required: false })
  async verifyWebhook(
    @Param('provider') provider: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const mode = req.query['hub.mode'] as string;
    const token = req.query['hub.verify_token'] as string;
    const challenge = req.query['hub.challenge'] as string;

    const result = await this.messagingService.verifyWebhook(
      provider.toUpperCase(),
      mode,
      token,
      challenge,
    );

    if (result) {
      return res.status(200).send(result);
    }
    return res.status(403).send('Forbidden');
  }

  @Post('webhooks/:provider')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process incoming webhook' })
  @ApiParam({ name: 'provider', example: 'WHATSAPP' })
  async processWebhook(
    @Param('provider') provider: string,
    @Body() body: Record<string, unknown>,
    @Headers('x-hub-signature-256') signature?: string,
  ) {
    return this.messagingService.processIncomingWebhook(
      provider.toUpperCase(),
      body,
      signature,
    );
  }
}
