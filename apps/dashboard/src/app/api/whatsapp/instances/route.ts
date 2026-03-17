import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createEvolutionClient } from '@/lib/whatsapp/evolution';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
    if (!profile?.org_id) return NextResponse.json({ error: 'Organization not found' }, { status: 400 });

    const body = await request.json();
    const { client_id, name, phone_number, is_primary } = body;

    if (!client_id || !name || !phone_number) {
      return NextResponse.json({ error: 'Faltam dados obrigatórios (cliente, nome ou telefone)' }, { status: 400 });
    }

    // Verificar se o cliente pertence à organização
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('id', client_id)
      .eq('org_id', profile.org_id)
      .single();

    if (!client) {
      return NextResponse.json({ error: 'Client not found or access denied' }, { status: 404 });
    }

    // Gera um nome seguro para a API da Evolution (sem espaços ou caracteres especiais)
    const safeName = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(0, 10);
    const instanceName = `org-${profile.org_id.slice(0, 8)}-cli-${client_id.slice(0, 8)}-${safeName}-${Date.now()}`;
    const evolutionClient = createEvolutionClient();

    // 1. Criar instância na Evolution API
    await evolutionClient.createInstance(instanceName);

    // 2. Buscar o QR Code gerado inicialmente
    let qrCode = null;
    try {
      const qrData = await evolutionClient.getQRCode(instanceName);
      qrCode = qrData.base64 || null;
    } catch (qrError) {
      console.error('[WhatsApp] Failed to get immediate QR code:', qrError);
    }

    // 3. Salvar no banco de dados
    const { data: instance, error: dbError } = await supabase
      .from('whatsapp_instances')
      .insert({
        org_id: profile.org_id,
        client_id,
        name,
        phone_number,
        is_primary: is_primary ?? true,
        instance_name: instanceName,
        status: 'connecting',
        qr_code: qrCode
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({ data: instance });
  } catch (error: any) {
    console.error('[WhatsApp POST Instances] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
    if (!profile?.org_id) return NextResponse.json({ error: 'Organization not found' }, { status: 400 });

    const { data, error } = await supabase
      .from('whatsapp_instances')
      .select(`
        id,
        name,
        instance_name,
        status,
        phone_number,
        is_primary,
        target_group_id,
        target_group_name,
        last_connected_at,
        client_id,
        clients ( name )
      `)
      .eq('org_id', profile.org_id)
      .neq('status', 'deleted');

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    console.error('[WhatsApp GET Instances] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}