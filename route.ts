import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Inicializa o cliente Admin do Supabase para contornar o RLS no webhook
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
    try {
        const url = new URL(request.url);
        const secret = url.searchParams.get('secret');

        // Validate Webhook Secret (As per GO_LIVE_BASIC.md)
        const validSecret = process.env.WHATSAPP_WEBHOOK_SECRET || process.env.EVOLUTION_WEBHOOK_SECRET;
        if (secret !== validSecret) {
            return NextResponse.json({ error: 'Unauthorized webhook access' }, { status: 401 });
        }

        const body = await request.json();

        // Evolution API typically sends the event type in the payload
        const eventType = body.event;
        const instanceName = body.instance;
        const data = body.data;

        console.log(`[WhatsApp Webhook] Received event: ${eventType} for instance: ${instanceName}`);

        switch (eventType) {
            case 'connection.update':
                const state = data.state;
                const newStatus = state === 'open' ? 'connected' : state === 'close' ? 'disconnected' : 'connecting';

                const updateData: any = { status: newStatus };
                if (state === 'open') {
                    updateData.last_connected_at = new Date().toISOString();
                }

                await supabaseAdmin
                    .from('whatsapp_instances')
                    .update(updateData)
                    .eq('instance_name', instanceName);

                console.log(`Connection state updated to: ${newStatus}`);
                break;

            case 'qrcode.updated':
                const qrCode = data.qrcode?.base64 || data.qrcode;
                await supabaseAdmin
                    .from('whatsapp_instances')
                    .update({ qr_code: qrCode, status: 'connecting' })
                    .eq('instance_name', instanceName);

                console.log('New QR Code updated in database');
                break;
            default:
                console.log('Unhandled event type:', eventType);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('[WhatsApp Webhook] Error processing request:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}