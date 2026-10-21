import { z } from "zod";
export declare const StripeWebhookItemSchema: z.ZodObject<{
    product_id: z.ZodString;
    product_name: z.ZodString;
    quantity: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
    unit_price: z.ZodNumber;
}, z.core.$strip>;
export declare const StripeWebhookPayloadSchema: z.ZodObject<{
    org_id: z.ZodString;
    external_order_id: z.ZodString;
    status: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    total_amount: z.ZodOptional<z.ZodNumber>;
    currency: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    customer_email: z.ZodOptional<z.ZodString>;
    customer_name: z.ZodOptional<z.ZodString>;
    tracking_session_id: z.ZodOptional<z.ZodString>;
    attribution_fbc: z.ZodOptional<z.ZodString>;
    attribution_fbp: z.ZodOptional<z.ZodString>;
    click_id: z.ZodOptional<z.ZodString>;
    items: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        product_id: z.ZodString;
        product_name: z.ZodString;
        quantity: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
        unit_price: z.ZodNumber;
    }, z.core.$strip>>>>;
}, z.core.$strip>;
export type StripeWebhookItem = z.infer<typeof StripeWebhookItemSchema>;
export type StripeWebhookPayload = z.infer<typeof StripeWebhookPayloadSchema>;
