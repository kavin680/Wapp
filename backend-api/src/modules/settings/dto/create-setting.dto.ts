import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow, IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateSettingDto {
  @ApiProperty({ example: 'messaging' })
  @IsString()
  category: string;

  @ApiProperty({ example: 'retry_limit' })
  @IsString()
  key: string;

  @ApiProperty({ example: 3 })
  @Allow()
  value: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
