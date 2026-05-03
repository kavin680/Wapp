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
import { ContactsService } from './contacts.service';
import { CreateContactDto, UpdateContactDto, ImportContactsDto } from './dto';
import { PaginationQueryDto } from '../../common/dtos';
import { CurrentUser } from '../../common/decorators';

@ApiTags('Contacts')
@ApiBearerAuth()
@Controller('contacts')
export class ContactsController {
  constructor(private readonly contactsService: ContactsService) {}

  @Get()
  @ApiOperation({ summary: 'List contacts' })
  findAll(
    @CurrentUser('sub') userId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.contactsService.findAll(userId, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get contact by ID' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  findOne(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.contactsService.findOne(id, userId);
  }

  @Post()
  @ApiOperation({ summary: 'Create a contact' })
  create(@Body() dto: CreateContactDto, @CurrentUser('sub') userId: string) {
    return this.contactsService.create(dto, userId);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a contact' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.contactsService.update(id, userId, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete a contact' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  remove(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.contactsService.remove(id, userId);
  }

  @Post('import')
  @ApiOperation({ summary: 'Bulk import contacts' })
  importContacts(
    @Body() dto: ImportContactsDto,
    @CurrentUser('sub') userId: string,
  ) {
    return this.contactsService.importContacts(dto, userId);
  }

  @Patch(':id/opt-in')
  @ApiOperation({ summary: 'Mark contact as opted in' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  optIn(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.contactsService.updateOptInStatus(id, userId, 'OPTED_IN');
  }

  @Patch(':id/opt-out')
  @ApiOperation({ summary: 'Mark contact as opted out' })
  @ApiParam({ name: 'id', description: 'Contact ID' })
  optOut(@Param('id') id: string, @CurrentUser('sub') userId: string) {
    return this.contactsService.updateOptInStatus(id, userId, 'OPTED_OUT');
  }
}
