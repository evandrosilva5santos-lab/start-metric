// app/settings/meta/page.tsx
// Página "Conectar Conta Meta Ads": conexão da organização e contas escolhidas para o painel.

import { redirect } from "next/navigation";

import MetaAccountsClient from "./MetaAccountsClient";
import type { MetaConnectionSummary, PanelMetaAccount } from "./types";
import { getDashboardSession } from "@/lib/auth/session";
import { HIDDEN_ACCOUNT_STATUS } from "@/lib/meta/account-groups";
import { IntegrationTabs } from "@/components/integrations/IntegrationTabs";

export const metadata = {
  title: "Conectar Meta Ads | Start Metric",
  description: "Conecte sua conta Meta Ads e escolha quais contas aparecem no painel.",
};

type SearchParams = { connected?: string; error?: string; adicionar?: string };

export default async function MetaSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams> | SearchParams;
}) {
  const session = await getDashboardSession();
  if (!session.isAuthorized) redirect("/auth");

  const supabase = session.supabase;
  const [accountsResult, clientsResult, connectionResult] = await Promise.all([
    supabase
      .from("ad_accounts")
      .select("id, name, external_id, status, currency, connected_at, token_expires_at, last_synced_at, client_id")
      .eq("org_id", session.orgId)
      .eq("platform", "meta")
      .neq("status", HIDDEN_ACCOUNT_STATUS)
      .order("connected_at", { ascending: false }),
    supabase.from("clients").select("id, name").eq("org_id", session.orgId).is("archived_at", null),
    supabase
      .from("meta_connections")
      .select("status, connected_at, token_expires_at")
      .eq("org_id", session.orgId)
      .maybeSingle(),
  ]);

  if (accountsResult.error) console.error("[settings/meta] Falha ao ler contas:", accountsResult.error.message);
  const clientNames = new Map((clientsResult.data ?? []).map((client) => [client.id, client.name]));
  const accounts: PanelMetaAccount[] = (accountsResult.data ?? []).map(({ client_id, ...account }) => ({
    ...account,
    client_name: client_id ? (clientNames.get(client_id) ?? null) : null,
  }));
  const connection: MetaConnectionSummary | null = connectionResult.data
    ? {
        status: connectionResult.data.status,
        connectedAt: connectionResult.data.connected_at,
        tokenExpiresAt: connectionResult.data.token_expires_at,
      }
    : null;

  const params = (await searchParams) ?? {};

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="mb-6">
        <p className="text-[12px] text-primary uppercase tracking-[0.2em] font-semibold mb-1">
          Integrações
        </p>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-primary-tint border border-primary/20 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-primary" viewBox="0 0 24 24" fill="currentColor">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-3xl font-extrabold text-fg tracking-tight leading-none">
              Meta Ads
            </h1>
            <p className="text-fg-muted text-sm mt-1">
              Conecte seu gerenciador de anúncios
            </p>
          </div>
        </div>
      </div>

      <IntegrationTabs active="meta" />

      <MetaAccountsClient
        accounts={accounts}
        connection={connection}
        flashConnected={params.connected === "true"}
        flashError={params.error}
        openPicker={params.adicionar === "1"}
      />
    </div>
  );
}
