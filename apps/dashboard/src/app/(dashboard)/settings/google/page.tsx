// Página "Conectar Google Ads": conexão da organização (conta de serviço ou login Google),
// teste de ponta a ponta e contas do MCC escolhidas para o painel.

import { redirect } from "next/navigation";
import { getDashboardSession } from "@/lib/auth/session";
import { IntegrationTabs } from "@/components/integrations/IntegrationTabs";
import GoogleSettingsClient from "./GoogleSettingsClient";

export const metadata = {
  title: "Conectar Google Ads | Start Metric",
  description: "Conecte o Google Ads da agência e escolha quais contas aparecem no painel.",
};

type SearchParams = { connected?: string; error?: string };

export default async function GoogleSettingsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const session = await getDashboardSession();
  if (!session.isAuthorized) redirect("/auth");
  const params = (await searchParams) ?? {};

  return (
    <div className="w-full space-y-6 animate-in fade-in duration-300">
      <div>
        <p className="mb-1 text-[12px] font-semibold uppercase tracking-[0.2em] text-primary">Integrações</p>
        <h1 className="text-3xl font-extrabold leading-none tracking-tight text-fg">Google Ads</h1>
        <p className="mt-1 text-sm text-fg-muted">Conecte o MCC da agência e traga contas, campanhas e métricas</p>
      </div>
      <IntegrationTabs active="google" />
      <GoogleSettingsClient flashConnected={params.connected === "true"} flashError={params.error} />
    </div>
  );
}
