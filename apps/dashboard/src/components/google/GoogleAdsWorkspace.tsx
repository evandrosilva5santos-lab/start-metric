"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Link2 } from "lucide-react";
import { GoogleAdsDashboard } from "@/components/google/GoogleAdsDashboard";
import { InsightsPanel } from "@/components/google/InsightsPanel";
import type { InsightKind } from "@/lib/google-ads/insights-core";
import { isValidRange, PRESETS, rangeFor, type Preset } from "@/lib/google-ads/period";

type Account = { id: string; name: string | null; external_id: string; status: string; client_id: string | null };
type Client = { id: string; name: string };
type CampaignOption = { id: string; name: string; status: string };

type TabId = "overview" | "keywords" | "terms" | "devices" | "locations" | "profile" | "visibility";

const TABS: Array<{ id: TabId; label: string; kinds: InsightKind[] }> = [
  { id: "overview", label: "Visão geral", kinds: [] },
  { id: "keywords", label: "Palavras-chave", kinds: ["keywords"] },
  { id: "terms", label: "Termos de pesquisa", kinds: ["search_terms"] },
  { id: "devices", label: "Dispositivos", kinds: ["devices"] },
  { id: "locations", label: "Localidades", kinds: ["locations"] },
  { id: "profile", label: "Perfil", kinds: ["gender", "age"] },
  { id: "visibility", label: "Visibilidade", kinds: ["visibility"] },
];

const selectClass = "min-h-11 max-w-[240px] rounded-md border border-border bg-input px-2 text-sm text-fg lg:min-h-9";
const dateClass = "min-h-11 rounded-md border border-border bg-input px-2 text-sm text-fg lg:min-h-9";
const RANGE_HINT = "Informe a data inicial e a final (no máximo 366 dias).";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Erro ${res.status}`);
  return body;
}

export function GoogleAdsWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = TABS.find((t) => t.id === searchParams.get("tab")) ?? TABS[0];
  const tab = activeTab.id;

  const [clientId, setClientId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [preset, setPreset] = useState<Preset | "custom">("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [compare, setCompare] = useState(false);

  const lists = useQuery({
    queryKey: ["google-ads", "accounts"],
    queryFn: () => getJson<{ accounts: Account[]; clients: Client[] }>("/api/google-ads"),
    staleTime: 60_000,
  });

  const activeAccounts = (lists.data?.accounts ?? []).filter((a) => a.status === "active");
  const accountOptions = activeAccounts.filter((a) => !clientId || a.client_id === clientId);
  const isInsightTab = tab !== "overview";
  const effectiveAccountId = isInsightTab ? (accountOptions.some((a) => a.id === accountId) ? accountId : (accountOptions[0]?.id ?? "")) : accountId;

  const range = preset === "custom" ? (isValidRange(customFrom, customTo) ? { from: customFrom, to: customTo } : null) : rangeFor(preset);

  const campaigns = useQuery({
    queryKey: ["google-ads", "campaign-options", effectiveAccountId],
    queryFn: () => getJson<{ campaigns: CampaignOption[] }>(`/api/automation/campaigns?accountId=${effectiveAccountId}`),
    enabled: isInsightTab && Boolean(effectiveAccountId),
    staleTime: 5 * 60_000,
  });

  const selectTab = (id: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id === "overview") params.delete("tab");
    else params.set("tab", id);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const noAccounts = lists.data && activeAccounts.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">Google Ads</h1>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Cliente"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setAccountId("");
              setCampaignId("");
            }}
            className={selectClass}
          >
            <option value="">Todos os clientes</option>
            {lists.data?.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Conta"
            value={effectiveAccountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setCampaignId("");
            }}
            className={selectClass}
          >
            {!isInsightTab && <option value="">Todas as contas</option>}
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name ?? a.external_id}
              </option>
            ))}
          </select>
          {isInsightTab && (
            <select aria-label="Campanha" value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={selectClass} disabled={!effectiveAccountId}>
              <option value="">Todas as campanhas</option>
              {campaigns.data?.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Período" className="flex flex-wrap gap-1.5">
          {[...PRESETS, { id: "custom" as const, label: "Personalizado" }].map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={preset === p.id}
              onClick={() => setPreset(p.id)}
              className={`min-h-11 rounded-full border px-3.5 text-sm font-medium transition-colors lg:min-h-8 ${
                preset === p.id ? "border-primary bg-primary-tint text-primary" : "border-border text-fg-muted hover:text-fg"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" aria-label="Data inicial" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className={dateClass} />
            <span className="text-sm text-fg-muted">até</span>
            <input type="date" aria-label="Data final" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className={dateClass} />
          </div>
        )}
        {isInsightTab && (
          <label className="ml-auto flex min-h-11 items-center gap-2 text-sm text-text-secondary lg:min-h-8">
            <input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} className="size-4 accent-primary" />
            Comparar com o período anterior
          </label>
        )}
      </div>

      <div role="tablist" aria-label="Análises do Google Ads" className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            aria-controls="google-tabpanel"
            onClick={() => selectTab(t.id)}
            className={`min-h-11 shrink-0 border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9 ${
              tab === t.id ? "border-primary text-foreground" : "border-transparent text-fg-muted hover:text-fg"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id="google-tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="space-y-6">
        {lists.isError && (
          <div role="alert" className="rounded-lg border border-danger/30 bg-danger-tint p-4 text-sm text-danger">
            {lists.error.message}
          </div>
        )}
        {noAccounts && isInsightTab ? (
          <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-8 text-center">
            <Link2 className="mx-auto text-primary" size={28} />
            <h2 className="mt-3 font-display text-lg font-semibold text-foreground">Nenhuma conta Google Ads no painel</h2>
            <Link href="/settings/google" className="mt-5 inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
              Conectar Google Ads
            </Link>
          </div>
        ) : !range ? (
          <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-text-secondary">{RANGE_HINT}</p>
        ) : tab === "overview" ? (
          <GoogleAdsDashboard controlled={{ clientId, accountId, from: range.from, to: range.to }} />
        ) : (
          activeTab.kinds.map((kind) => (
            <InsightsPanel
              key={kind}
              kind={kind}
              accountId={effectiveAccountId}
              from={range.from}
              to={range.to}
              campaignId={campaignId}
              compare={compare}
              showTitle={activeTab.kinds.length > 1}
            />
          ))
        )}
      </div>
    </div>
  );
}
