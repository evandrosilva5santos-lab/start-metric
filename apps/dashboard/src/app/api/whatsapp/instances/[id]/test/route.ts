import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createEvolutionClient } from '../../../../../../../../../packages/whatsapp/src/client';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const phone = body.phone;

    const { data: profile } = await supabase.from('profiles').select('org_id, phone').eq('id', user.id).single();

    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('id', id)
      .eq('org_id', profile?.org_id)
      .single();

    if (instanceError || !instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    if (instance.status !== 'connected') {
      return NextResponse.json({ error: 'Instance is not connected' }, { status: 400 });
    }

    const targetPhone = phone || instance.phone_number || profile?.phone;
    if (!targetPhone) {
      return NextResponse.json({ error: 'No phone number available to send test message' }, { status: 400 });
    }

    const cleanPhone = targetPhone.replace(/\D/g, '');
    const evolutionClient = createEvolutionClient();

    await evolutionClient.sendText(instance.instance_name, cleanPhone, "✅ Teste de conexão — Start Metric. O WhatsApp do seu cliente foi conectado com sucesso!");

    return NextResponse.json({ data: { sent: true, phone: cleanPhone } });
  } catch (error: any) {
    console.error('[WhatsApp Instance TEST POST] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}