import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createEvolutionClient } from '@/lib/whatsapp/evolution';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const body = await request.json();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single();
    if (!profile?.org_id) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    const updates: any = {};
    if (body.target_group_id !== undefined) updates.target_group_id = body.target_group_id;
    if (body.target_group_name !== undefined) updates.target_group_name = body.target_group_name;

    const { data, error } = await supabase.from('whatsapp_instances')
      .update(updates).eq('id', id).eq('org_id', profile.org_id).select().single();
    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
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

    try {
      await evolutionClient.deleteInstance(instance.instance_name);
    } catch (e: any) {
      console.error('Error deleting instance in Evolution API:', e.message);
    }

    const { error: dbError } = await supabase
      .from('whatsapp_instances')
      .delete()
      .eq('id', id);

    if (dbError) throw dbError;

    return NextResponse.json({ data: { deleted: true } });
  } catch (error: any) {
    console.error('[WhatsApp Instance DELETE] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}