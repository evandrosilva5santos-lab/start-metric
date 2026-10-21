// @start-metric/types/orders
// Stripe Webhook Payload
import { z } from "zod";

export const StripeWebhookItemSchema = z.object({
  product_id: z.string(),
  product_name: z.string(),
  quantity: z.number().optional().default(1),
  unit_price: z.number(),
});

export const StripeWebhookPayloadSchema = z.object({
  org_id: z.string().uuid(),
  external_order_id: z.string(),
  status: z.string().optional().default("completed"),
  total_amount: z.number().optional(),
  currency: z.string().optional().default("BRL"),
  customer_email: z.string().email().optional(),
  customer_name: z.string().optional(),
  tracking_session_id: z.string().optional(),
  attribution_fbc: z.string().optional(),
  attribution_fbp: z.string().optional(),
  click_id: z.string().optional(),
  
  // Array of items in the order
  items: z.array(StripeWebhookItemSchema).optional().default([]),
});

export type StripeWebhookItem = z.infer<typeof StripeWebhookItemSchema>;
export type StripeWebhookPayload = z.infer<typeof StripeWebhookPayloadSchema>;
