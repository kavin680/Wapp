import { ApiProperty } from '@nestjs/swagger';
import { Allow, IsString } from 'class-validator';

export class SetUserPreferenceDto {
  @ApiProperty({ example: 'notification_sound' })
  @IsString()
  key: string;

  @ApiProperty({ example: true })
  @Allow()
  value: unknown;
}
