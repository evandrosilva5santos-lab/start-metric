import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createEvolutionClient } from '../../../../../../../../../packages/whatsapp/src/client';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q')?.toLowerCase() || '';

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();

    const { data: instance, error: instanceError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('id', id)
      .eq('org_id', profile?.org_id)
      .single();

    if (instanceError || !instance) return NextResponse.json({ error: 'Instance not found' }, { status: 404 });

    const evolutionClient = createEvolutionClient();
    const allGroups = await evolutionClient.fetchGroups(instance.instance_name);

    const safeGroups = allGroups.filter((group: any) => {
      // Filtra pelo nome do grupo (suporta emojis nativamente)
      if (query && !group.subject?.toLowerCase().includes(query)) return false;

      // Validação de Segurança: verifica se o número da instância é um ADM no grupo
      const botParticipant = group.participants?.find((p: any) =>
        p.id.startsWith(instance.phone_number)
      );

      return botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
    });

    return NextResponse.json({ data: safeGroups });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}