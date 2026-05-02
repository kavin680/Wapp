import {
  Controller,
  Get,
  Post,
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
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto';
import { PaginationQueryDto } from '../../common/dtos';
import { CurrentUser } from '../../common/decorators';

@ApiTags('API Keys')
@ApiBearerAuth()
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Get()
  @ApiOperation({ summary: 'List API keys' })
  findAll(
    @CurrentUser('sub') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.apiKeysService.findAll(userId, query);
  }

  @Post()
  @ApiOperation({ summary: 'Create an API key' })
  create(@Body() dto: CreateApiKeyDto, @CurrentUser('sub') userId: string) {
    return this.apiKeysService.create(dto, userId);
  }

  @Patch(':id/revoke')
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiParam({ name: 'id', description: 'API Key ID' })
  revoke(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.apiKeysService.revoke(id, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an API key' })
  @ApiParam({ name: 'id', description: 'API Key ID' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.apiKeysService.remove(id, userId);
  }
}
