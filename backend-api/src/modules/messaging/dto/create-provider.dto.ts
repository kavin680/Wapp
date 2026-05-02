import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

enum ProviderType {
  WHATSAPP = 'WHATSAPP',
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  TELEGRAM = 'TELEGRAM',
  MESSENGER = 'MESSENGER',
  SLACK = 'SLACK',
}

export class CreateProviderDto {
  @ApiProperty({ example: 'WhatsApp Cloud API' })
  @IsString()
  name: string;

  @ApiProperty({ enum: ProviderType, example: ProviderType.WHATSAPP })
  @IsEnum(ProviderType)
  type: ProviderType;

  @ApiPropertyOptional({ example: 'Meta WhatsApp Cloud API provider' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
