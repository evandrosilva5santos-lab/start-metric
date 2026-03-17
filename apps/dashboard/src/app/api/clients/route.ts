import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Schema para validação
const createClientSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().max(20).optional(),
  whatsapp: z.string().max(20).optional(),
  logo_url: z.string().url("URL inválida").optional().or(z.literal("")),
  notes: z.string().max(1000).optional(),
  account_ids: z.array(z.string().uuid()).optional(),
});

type ClientListRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  logo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  ad_accounts: { count: number | null }[] | null;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (!profile?.org_id) {
      return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 });
    }

    // Buscar clientes com contagem de ad_accounts (com fallback se embedded count falhar)
    let clients: ClientListRow[] | null = null;
    let clientsError = null;

    // Tentar com embedded count primeiro
    const { data: clientsWithCount, error: countError } = await supabase
      .from("clients")
      .select(`
        id,
        name,
        email,
        phone,
        whatsapp,
        logo_url,
        notes,
        archived_at,
        created_at,
        updated_at,
        ad_accounts(count)
      `)
      .eq("org_id", profile.org_id)
      .is("archived_at", null)
      .order("created_at", { ascending: false });

    if (countError) {
      // Se embedded count falhar, buscar sem count e calcular depois
      console.warn("Embedded count falhou, buscando clientes sem contagem:", countError);
      const { data: clientsWithoutCount, error: basicError } = await supabase
        .from("clients")
        .select(`
          id,
          name,
          email,
          phone,
          whatsapp,
          logo_url,
          notes,
          archived_at,
          created_at,
          updated_at
        `)
        .eq("org_id", profile.org_id)
        .is("archived_at", null)
        .order("created_at", { ascending: false });

      if (basicError) {
        console.error("Erro ao buscar clientes (fallback):", basicError);
        return NextResponse.json({ error: "Erro ao buscar clientes" }, { status: 500 });
      }

      clients = (clientsWithoutCount ?? []).map((c) => ({
        ...c,
        ad_accounts: [],
      })) as ClientListRow[];
      clientsError = null;
    } else {
      clients = clientsWithCount;
      clientsError = null;
    }

    const { data: whatsappInstances, error: whatsappError } = await supabase
      .from("whatsapp_instances")
      .select("client_id, status, updated_at, last_connected_at")
      .eq("org_id", profile.org_id)
      .neq("status", "deleted")
      .not("client_id", "is", null);

    if (whatsappError) {
      console.error("Erro ao buscar status do WhatsApp por cliente:", whatsappError);
    }

    const whatsappByClient = new Map<
      string,
      {
        status: string;
        updated_at: string;
        last_connected_at: string | null;
      }
    >();

    (whatsappInstances ?? []).forEach((instance) => {
      if (!instance.client_id) return;

      const previous = whatsappByClient.get(instance.client_id);
      if (!previous) {
        whatsappByClient.set(instance.client_id, {
          status: instance.status,
          updated_at: instance.updated_at,
          last_connected_at: instance.last_connected_at,
        });
        return;
      }

      const previousIsConnected = previous.status === "connected";
      const currentIsConnected = instance.status === "connected";
      if (currentIsConnected && !previousIsConnected) {
        whatsappByClient.set(instance.client_id, {
          status: instance.status,
          updated_at: instance.updated_at,
          last_connected_at: instance.last_connected_at,
        });
        return;
      }

      if (currentIsConnected === previousIsConnected) {
        const previousTime = new Date(previous.updated_at).getTime();
        const currentTime = new Date(instance.updated_at).getTime();
        if (currentTime > previousTime) {
          whatsappByClient.set(instance.client_id, {
            status: instance.status,
            updated_at: instance.updated_at,
            last_connected_at: instance.last_connected_at,
          });
        }
      }
    });

    // Formatar resposta com contagem de contas e status do WhatsApp
    const formattedClients = ((clients ?? []) as ClientListRow[]).map((client) => {
      const whatsappConnection = whatsappByClient.get(client.id);

      return {
        id: client.id,
        name: client.name,
        email: client.email,
        phone: client.phone,
        whatsapp: client.whatsapp,
        logo_url: client.logo_url,
        notes: client.notes,
        created_at: client.created_at,
        updated_at: client.updated_at,
        accounts_count: client.ad_accounts?.[0]?.count ?? 0,
        whatsapp_status: whatsappConnection?.status ?? "disconnected",
        whatsapp_connected: whatsappConnection?.status === "connected",
        whatsapp_last_connected_at: whatsappConnection?.last_connected_at ?? null,
      };
    });

    return NextResponse.json({ data: formattedClients });
  } catch (error) {
    console.error("Erro ao processar requisição:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (!profile?.org_id) {
      return NextResponse.json({ error: "Organização não encontrada" }, { status: 404 });
    }

    const body = await request.json();
    const validatedData = createClientSchema.parse(body);

    // Criar cliente
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .insert({
        org_id: profile.org_id,
        name: validatedData.name,
        email: validatedData.email || null,
        phone: validatedData.phone || null,
        whatsapp: validatedData.whatsapp || null,
        logo_url: validatedData.logo_url || null,
        notes: validatedData.notes || null,
      })
      .select()
      .single();

    if (clientError) {
      console.error("Erro ao criar cliente:", clientError);
      return NextResponse.json({ error: "Erro ao criar cliente" }, { status: 500 });
    }

    // Associar contas de anúncio se fornecidas
    if (validatedData.account_ids && validatedData.account_ids.length > 0) {
      const { error: accountsError } = await supabase
        .from("ad_accounts")
        .update({ client_id: client.id })
        .in("id", validatedData.account_ids)
        .eq("org_id", profile.org_id);

      if (accountsError) {
        console.error("Erro ao associar contas:", accountsError);
        // Não falhar a requisição, apenas logar o erro
      }
    }

    return NextResponse.json({ data: client }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos", details: error.issues }, { status: 400 });
    }
    console.error("Erro ao processar requisição:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
