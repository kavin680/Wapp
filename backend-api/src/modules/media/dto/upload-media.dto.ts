import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UploadMediaDto {
  @ApiProperty({ enum: ['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER'] })
  @IsEnum(['IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT', 'STICKER'])
  type: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  messageId?: string;
}
