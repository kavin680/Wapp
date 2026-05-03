import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
