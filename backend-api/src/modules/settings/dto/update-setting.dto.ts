import { ApiPropertyOptional } from '@nestjs/swagger';
import { Allow, IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateSettingDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Allow()
  value?: unknown;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
