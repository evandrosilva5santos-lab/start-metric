import { Controller, Post, RawBodyRequest, Headers, HttpStatus, HttpCode } from '@nestjs/common';
import { Request } from 'express';
import { StripeWebhookService } from './stripe-webhook.service';

@Controller('webhooks/stripe')
export class StripeWebhookController {
  constructor(private readonly stripeWebhookService: StripeWebhookService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @RawBodyRequest() req: RawBodyRequest<Request>,
    @Headers('stripe-signature') signature: string,
  ) {
    await this.stripeWebhookService.processWebhook(req.rawBody, signature);
    return { received: true };
  }
}
