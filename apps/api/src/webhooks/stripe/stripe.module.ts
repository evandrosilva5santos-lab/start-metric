import { Module } from '@nestjs/common';
import { StripeWebhookController } from './stripe.controller';
import { StripeWebhookService } from './stripe-webhook.service';
import { PrismaModule } from '../../prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StripeWebhookController],
  providers: [StripeWebhookService],
  exports: [StripeWebhookService],
})
export class StripeWebhookModule {}
