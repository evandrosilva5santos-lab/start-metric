import { getDashboardSession } from "@/lib/auth/session";
import { listOperationalAccounts } from "@/lib/accounts/operational";
import { AlertRulesConfig, type RuleScopeOptions } from "./AlertRulesConfig";

const OPTIONS_LIMIT = 500;

async function loadScopeOptions(): Promise<RuleScopeOptions | null> {
  const session = await getDashboardSession();
  if (!session.isAuthorized) return null;
  const inventory = await listOperationalAccounts(session.supabase, session.orgId);
  const accounts = inventory.accounts.slice(0, OPTIONS_LIMIT);
  const accountIds = accounts.map((account) => account.id);
  const campaigns =
    accountIds.length === 0
      ? { data: [], error: null }
      : await session.supabase
          .from("campaigns")
          .select("id, name, ad_account_id")
          .eq("org_id", session.orgId)
          .in("ad_account_id", accountIds)
          .order("name")
          .limit(OPTIONS_LIMIT);
  if (campaigns.error) return null;
  const clientIds = new Set(accounts.map((account) => account.client_id));
  return {
    clients: inventory.clients
      .filter((client) => clientIds.has(client.id))
      .map((client) => ({ id: client.id, name: client.name })),
    accounts: accounts.map((account) => ({
      id: account.id,
      name: account.name,
      client_id: account.client_id,
    })),
    campaigns: campaigns.data ?? [],
  };
}

export async function AlertRulesSection() {
  const options = await loadScopeOptions();
  return <AlertRulesConfig options={options ?? { clients: [], accounts: [], campaigns: [] }} optionsFailed={!options} />;
}

export function AlertRulesSectionSkeleton() {
  return (
    <div role="status" aria-label="Carregando regras" className="flex flex-col gap-3 rounded-panel border border-border bg-surface p-5 shadow-card">
      {[0, 1, 2].map((row) => (
        <div key={row} className="h-10 animate-pulse rounded-control bg-subtle motion-reduce:animate-none" />
      ))}
    </div>
  );
}
