"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeWebhookPayloadSchema = exports.StripeWebhookItemSchema = void 0;
// @start-metric/types/orders
// Stripe Webhook Payload
const zod_1 = require("zod");
exports.StripeWebhookItemSchema = zod_1.z.object({
    product_id: zod_1.z.string(),
    product_name: zod_1.z.string(),
    quantity: zod_1.z.number().optional().default(1),
    unit_price: zod_1.z.number(),
});
exports.StripeWebhookPayloadSchema = zod_1.z.object({
    org_id: zod_1.z.string().uuid(),
    external_order_id: zod_1.z.string(),
    status: zod_1.z.string().optional().default("completed"),
    total_amount: zod_1.z.number().optional(),
    currency: zod_1.z.string().optional().default("BRL"),
    customer_email: zod_1.z.string().email().optional(),
    customer_name: zod_1.z.string().optional(),
    tracking_session_id: zod_1.z.string().optional(),
    attribution_fbc: zod_1.z.string().optional(),
    attribution_fbp: zod_1.z.string().optional(),
    click_id: zod_1.z.string().optional(),
    // Array of items in the order
    items: zod_1.z.array(exports.StripeWebhookItemSchema).optional().default([]),
});
