import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [DatabaseModule, MessagingModule],
  controllers: [TemplatesController],
  providers: [TemplatesService],
  exports: [TemplatesService],
})
export class TemplatesModule {}
