import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsObject, IsOptional, IsString } from 'class-validator';

export class AddRecipientsDto {
  @ApiProperty({ example: ['contact-uuid-1', 'contact-uuid-2'] })
  @IsArray()
  @IsString({ each: true })
  contactIds: string[];

  @ApiPropertyOptional({ description: 'Template ID override' })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Variables for template' })
  @IsOptional()
  @IsObject()
  variables?: Record<string, unknown>;
}
