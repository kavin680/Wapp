import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  Body,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { MediaService } from './media.service';
import { UploadMediaDto } from './dto';
import { PaginationQueryDto } from '../../common/dtos';

@ApiTags('Media Assets')
@ApiBearerAuth()
@Controller('media')
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Get()
  @ApiOperation({ summary: 'List media assets' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.mediaService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get media asset by ID' })
  @ApiParam({ name: 'id', description: 'Media asset ID' })
  findOne(@Param('id') id: string) {
    return this.mediaService.findOne(id);
  }

  @Get('message/:messageId')
  @ApiOperation({ summary: 'Get media assets for a message' })
  @ApiParam({ name: 'messageId', description: 'Message ID' })
  findByMessage(@Param('messageId') messageId: string) {
    return this.mediaService.findByMessage(messageId);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a media asset' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        type: {
          type: 'string',
          enum: ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER'],
        },
        messageId: { type: 'string' },
      },
    },
  })
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadMediaDto,
  ) {
    return this.mediaService.upload(
      {
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
        buffer: file.buffer,
      },
      dto.type,
      dto.messageId,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a media asset' })
  @ApiParam({ name: 'id', description: 'Media asset ID' })
  remove(@Param('id') id: string) {
    return this.mediaService.remove(id);
  }
}
