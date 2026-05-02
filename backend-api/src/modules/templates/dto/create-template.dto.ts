import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

enum TemplateCategory {
  MARKETING = 'MARKETING',
  UTILITY = 'UTILITY',
  AUTHENTICATION = 'AUTHENTICATION',
  SERVICE = 'SERVICE',
}

enum ChannelType {
  WHATSAPP = 'WHATSAPP',
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  TELEGRAM = 'TELEGRAM',
  MESSENGER = 'MESSENGER',
  SLACK = 'SLACK',
}

export class CreateTemplateDto {
  @ApiProperty({ description: 'Provider ID' })
  @IsString()
  providerId: string;

  @ApiProperty({ example: 'hello_world' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'en', default: 'en' })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiPropertyOptional({ enum: TemplateCategory, default: 'MARKETING' })
  @IsOptional()
  @IsEnum(TemplateCategory)
  category?: TemplateCategory;

  @ApiPropertyOptional({ enum: ChannelType, default: 'WHATSAPP' })
  @IsOptional()
  @IsEnum(ChannelType)
  channel?: ChannelType;

  @ApiPropertyOptional({ example: 'TEXT' })
  @IsOptional()
  @IsString()
  headerType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  headerContent?: Record<string, unknown>;

  @ApiProperty({ example: 'Hello {{1}}, welcome to our service!' })
  @IsString()
  bodyContent: string;

  @ApiPropertyOptional({ example: 'Reply STOP to unsubscribe' })
  @IsOptional()
  @IsString()
  footerContent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  buttons?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
