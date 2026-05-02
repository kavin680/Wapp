import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import {
  CreateSettingDto,
  UpdateSettingDto,
  SetUserPreferenceDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../common/enums';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // ─── System Settings (Admin) ────────────────────────────────────────────────

  @Get('system')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'List all system settings' })
  @ApiQuery({ name: 'category', required: false })
  findAll(@Query('category') category?: string) {
    return this.settingsService.findAll(category);
  }

  @Get('system/public')
  @ApiOperation({ summary: 'List public settings' })
  @ApiQuery({ name: 'category', required: false })
  findPublic(@Query('category') category?: string) {
    return this.settingsService.findPublic(category);
  }

  @Get('system/:category/:key')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get a specific system setting' })
  @ApiParam({ name: 'category' })
  @ApiParam({ name: 'key' })
  findOne(@Param('category') category: string, @Param('key') key: string) {
    return this.settingsService.findOne(category, key);
  }

  @Post('system')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a system setting' })
  create(@Body() dto: CreateSettingDto) {
    return this.settingsService.create(dto);
  }

  @Put('system/:category/:key')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a system setting' })
  @ApiParam({ name: 'category' })
  @ApiParam({ name: 'key' })
  update(
    @Param('category') category: string,
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
  ) {
    return this.settingsService.update(category, key, dto);
  }

  @Delete('system/:category/:key')
  @Roles(Role.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete a system setting' })
  @ApiParam({ name: 'category' })
  @ApiParam({ name: 'key' })
  remove(@Param('category') category: string, @Param('key') key: string) {
    return this.settingsService.remove(category, key);
  }

  // ─── User Preferences ──────────────────────────────────────────────────────

  @Get('preferences')
  @ApiOperation({ summary: 'Get user preferences' })
  getUserPreferences(@CurrentUser('sub') userId: string) {
    return this.settingsService.getUserPreferences(userId);
  }

  @Get('preferences/:key')
  @ApiOperation({ summary: 'Get a specific user preference' })
  @ApiParam({ name: 'key' })
  getUserPreference(
    @CurrentUser('sub') userId: string,
    @Param('key') key: string,
  ) {
    return this.settingsService.getUserPreference(userId, key);
  }

  @Post('preferences')
  @ApiOperation({ summary: 'Set a user preference' })
  setUserPreference(
    @CurrentUser('sub') userId: string,
    @Body() dto: SetUserPreferenceDto,
  ) {
    return this.settingsService.setUserPreference(userId, dto);
  }

  @Delete('preferences/:key')
  @ApiOperation({ summary: 'Delete a user preference' })
  @ApiParam({ name: 'key' })
  deleteUserPreference(
    @CurrentUser('sub') userId: string,
    @Param('key') key: string,
  ) {
    return this.settingsService.deleteUserPreference(userId, key);
  }
}
