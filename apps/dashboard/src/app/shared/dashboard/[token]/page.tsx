import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SharedDashboardClient from "./SharedDashboardClient";

interface SharedDashboardPageProps {
  params: { token: string };
  searchParams: { password?: string };
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  daily_metrics: Array<{
    date: string;
    spend: number;
    conversions: number;
    roas: number;
    clicks: number;
    impressions: number;
  }>;
}

export default async function SharedDashboardPage({
  params,
  searchParams,
}: SharedDashboardPageProps) {
  const supabase = await createClient();

  // 1. Validar token
  let validationData: { client_id: string; org_id: string; access_type: string };
  try {
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/shared/validate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: params.token,
          password: searchParams.password,
        }),
        next: { revalidate: 0 }, // Sem cache para segurança
      }
    );

    if (!response.ok) {
      const data = await response.json();

      // Se requer senha, redirecionar para página de auth
      if (response.status === 403 && data.error.includes("Senha requerida")) {
        redirect(`/shared/auth/${params.token}`);
      }

      // Outros erros - redirecionar para erro
      redirect(`/?error=${encodeURIComponent(data.error)}`);
    }

    const result = await response.json();
    validationData = result.data;
  } catch (error) {
    console.error("Erro ao validar dashboard compartilhado:", error);
    redirect("/?error=Erro ao carregar dashboard");
    return; // TypeScript unreachable guard
  }

  const { client_id, org_id, access_type } = validationData;

  // 2. Buscar dados do cliente
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id, name, email, phone, org_id")
    .eq("id", client_id)
    .eq("org_id", org_id)
    .single();

  if (clientError || !client) {
    redirect("/?error=Cliente não encontrado");
  }

  // 3. Buscar dados da organização (para marca branca)
  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", org_id)
    .single();

  if (orgError || !organization) {
    redirect("/?error=Organização não encontrada");
  }

  const typedOrganization = { ...organization, logo_url: null as string | null };

  // 4. Buscar campanhas do cliente (últimas 14 dias)
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const { data: campaigns = [] } = await supabase
    .from("campaigns")
    .select(`
      id,
      name,
      status,
      daily_metrics(
        date,
        spend,
        conversions,
        roas,
        clicks,
        impressions
      )
    `)
    .eq("ad_account_id", client.id)
    .gte("created_at", fourteenDaysAgo.toISOString());

  const campaignsList = campaigns as Campaign[];

  return (
    <SharedDashboardClient
      token={params.token}
      client={client}
      organization={typedOrganization}
      campaigns={campaignsList}
      accessType={access_type}
    />
  );
}
