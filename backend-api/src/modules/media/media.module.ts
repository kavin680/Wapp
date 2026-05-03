import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  imports: [DatabaseModule],
  controllers: [MediaController],
  providers: [MediaService],
  exports: [MediaService],
})
export class MediaModule {}
