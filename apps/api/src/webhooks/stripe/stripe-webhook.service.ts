import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma.service';
import { createAttributionEngine } from '@start-metric/attribution';
import type { Order } from '@start-metric/types';

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return 0;
}

function mapOrderForAttribution(order: {
  id: string;
  org_id: string;
  stripe_checkout_session_id: string;
  stripe_payment_intent_id: string;
  amount_total: unknown;
  amount_subtotal: unknown;
  amount_tax: unknown;
  amount_refunded: unknown;
  currency: string;
  status: string;
  metadata: unknown;
  created_at: Date;
  updated_at: Date;
}): Order {
  return {
    id: order.id,
    org_id: order.org_id,
    stripe_checkout_session_id: order.stripe_checkout_session_id,
    stripe_payment_intent_id: order.stripe_payment_intent_id,
    amount_total: toNumber(order.amount_total),
    amount_subtotal: toNumber(order.amount_subtotal),
    amount_tax: toNumber(order.amount_tax),
    amount_refunded: toNumber(order.amount_refunded),
    currency: order.currency,
    status: order.status as Order['status'],
    metadata: (order.metadata ?? {}) as Order['metadata'],
    created_at: order.created_at.toISOString(),
    updated_at: order.updated_at.toISOString(),
  };
}

@Injectable()
export class StripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.stripe = new Stripe(this.config.get('STRIPE_SECRET_KEY') || '');
    this.webhookSecret = this.config.get('STRIPE_WEBHOOK_SECRET') || '';
  }

  async processWebhook(rawBody: Buffer, signature: string) {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody.toString(),
        signature,
        this.webhookSecret,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`Webhook signature verification failed: ${message}`);
      throw new UnauthorizedException('Invalid signature');
    }

    this.logger.log(`Processing Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object);
        break;

      case 'charge.refunded':
      case 'charge.refund.updated':
        await this.handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object);
        break;

      default:
        this.logger.log(`Unhandled event type: ${event.type}`);
    }
  }

  private async handleCheckoutSessionCompleted(
    session: Stripe.Checkout.Session,
  ) {
    this.logger.log(`Checkout session completed: ${session.id}`);

    // Extrair metadata do checkout
    const metadata = session.metadata || {};

    // Buscar org_id pelo customer_id ou metadata
    const orgId = metadata.org_id;
    if (!orgId) {
      this.logger.warn(`No org_id found in session ${session.id}`);
      return;
    }

    // Criar order no banco
    const order = await this.prisma.orders.create({
      data: {
        id: `order_${session.id}`,
        org_id: orgId,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent as string,
        amount_subtotal: (session.amount_subtotal || 0) / 100,
        amount_tax: (session.total_details?.amount_tax || 0) / 100,
        amount_total: (session.amount_total || 0) / 100,
        amount_refunded: 0,
        currency: (session.currency ?? 'brl').toUpperCase(),
        status: 'complete',
        metadata: {
          click_id: metadata.click_id,
          utm_source: metadata.utm_source,
          utm_medium: metadata.utm_medium,
          utm_campaign: metadata.utm_campaign,
          utm_content: metadata.utm_content,
          utm_term: metadata.utm_term,
          fbclid: metadata.fbclid,
          gclid: metadata.gclid,
          fbc: metadata.fbc,
          fbp: metadata.fbp,
        },
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    this.logger.log(`Order created: ${order.id}`);

    // Atribuir order à campanha
    const attributionEngine = createAttributionEngine(this.prisma as any);
    const result = await attributionEngine.attributeOrder(
      mapOrderForAttribution(order),
      {
        model: 'last_click',
        conversionWindowDays: 30,
        fallbackToUtm: true,
      },
    );

    if (result.attribution) {
      this.logger.log(
        `Order ${order.id} attributed to campaign ${result.attribution.campaign_id}`,
      );
    } else {
      this.logger.warn(`Order ${order.id} could not be attributed`);
    }
  }

  private async handleChargeRefunded(charge: Stripe.Charge) {
    this.logger.log(`Charge refunded: ${charge.id}`);

    // Buscar order pelo payment_intent_id
    const order = await this.prisma.orders.findFirst({
      where: {
        stripe_payment_intent_id: charge.payment_intent as string,
      },
    });

    if (!order) {
      this.logger.warn(`No order found for charge ${charge.id}`);
      return;
    }

    // Atualizar amount_refunded
    await this.prisma.orders.update({
      where: { id: order.id },
      data: {
        amount_refunded: charge.amount_refunded / 100,
        status: 'refunded',
        updated_at: new Date(),
      },
    });

    this.logger.log(`Order ${order.id} refunded`);
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
    this.logger.log(`Payment failed: ${paymentIntent.id}`);

    // Buscar checkout session para criar order com status failed
    const sessions = await this.stripe.checkout.sessions.list({
      payment_intent: paymentIntent.id,
      limit: 1,
    });

    if (sessions.data.length === 0) {
      this.logger.warn(
        `No checkout session found for payment intent ${paymentIntent.id}`,
      );
      return;
    }

    const session = sessions.data[0];
    const metadata = session.metadata || {};
    const orgId = metadata.org_id;

    if (!orgId) {
      this.logger.warn(`No org_id found in session ${session.id}`);
      return;
    }

    // Criar order com status failed
    await this.prisma.orders.create({
      data: {
        id: `order_${session.id}`,
        org_id: orgId,
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: paymentIntent.id,
        amount_subtotal: (session.amount_subtotal || 0) / 100,
        amount_tax: (session.total_details?.amount_tax || 0) / 100,
        amount_total: (session.amount_total || 0) / 100,
        amount_refunded: 0,
        currency: (session.currency ?? 'brl').toUpperCase(),
        status: 'failed',
        metadata: metadata as any,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    this.logger.log(
      `Failed order created for payment intent ${paymentIntent.id}`,
    );
  }
}
