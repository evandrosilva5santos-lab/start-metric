import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createEvolutionClient } from '@/lib/whatsapp/evolution';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
    if (!profile?.org_id) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('id', id)
      .eq('org_id', profile.org_id)
      .single();

    if (instanceError || !instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    const evolutionClient = createEvolutionClient();

    let stateData;
    try {
      stateData = await evolutionClient.getConnectionState(instance.instance_name);
    } catch (e) {
      console.error('Error fetching connection state:', e);
      return NextResponse.json({ data: instance });
    }

    const apiState = stateData.instance?.state;
    const newStatus = apiState === 'open' ? 'connected' : apiState === 'close' ? 'disconnected' : 'connecting';

    let updateData: any = {};
    let needsUpdate = false;

    if (instance.status !== newStatus) {
      updateData.status = newStatus;
      needsUpdate = true;
      if (newStatus === 'connected') {
        updateData.last_connected_at = new Date().toISOString();
      }
    }

    // Se não estiver conectado, tenta obter um QR Code novo caso o banco esteja desatualizado
    if (newStatus === 'disconnected' || newStatus === 'connecting') {
      try {
        const qrData = await evolutionClient.getQRCode(instance.instance_name);
        if (qrData.base64 && qrData.base64 !== instance.qr_code) {
          updateData.qr_code = qrData.base64;
          updateData.status = 'connecting';
          needsUpdate = true;
        }
      } catch (qrErr) {
        // Ignora erros de QR code expirado temporariamente
      }
    }

    if (needsUpdate) {
      await supabase.from('whatsapp_instances').update(updateData).eq('id', id);
      Object.assign(instance, updateData);
    }

    return NextResponse.json({
      data: { status: instance.status, qr_code: instance.qr_code, phone_number: instance.phone_number }
    });
  } catch (error: any) {
    console.error('[WhatsApp Instance Status GET] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}