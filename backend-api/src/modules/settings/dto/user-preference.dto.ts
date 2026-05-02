import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SetUserPreferenceDto {
  @ApiProperty({ example: 'notification_sound' })
  @IsString()
  key: string;

  @ApiProperty({ example: true })
  value: unknown;
}
