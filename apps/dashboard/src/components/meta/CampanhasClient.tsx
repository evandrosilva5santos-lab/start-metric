"use client";

import { useEffect, useMemo, useState } from "react";
import { Inbox, Search } from "lucide-react";
import { Button, EmptyState, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { useDashboardFilters } from "@/store/dashboard-filters";
import { useMetaDados } from "@/hooks/useMetaDashboard";
import { formatInteger, formatMoney, formatRate } from "@/lib/format";
import { MetaDataGate, PageHeading } from "@/components/meta/MetaUi";
import { needsAttention } from "@/components/meta/DiagnosticoClient";
import { SituationPill } from "@/components/dashboard/DashboardClient";
import type { DadosResponse, MetaCampaign } from "@/lib/meta/dados-types";

type Pill = "todas" | "ativas" | "pausadas" | "atencao";

const inputClass =
  "h-9 rounded-lg border border-border bg-input text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted hover:border-white-hairline-strong focus-visible:ring-2 focus-visible:ring-ring";

export function CampanhasClient() {
  return (
    <div className="space-y-6">
      <PageHeading title="Campanhas" subtitle="Acompanhe, analise e ajuste sem abrir o Gerenciador" />
      <MetaDataGate>{(data) => <Campanhas data={data} />}</MetaDataGate>
    </div>
  );
}

function Campanhas({ data }: { data: DadosResponse }) {
  const hide = useDashboardFilters((s) => s.hideValues);
  const { updateCampaign } = useMetaDados();
  const [pill, setPill] = useState<Pill>("todas");
  const [search, setSearch] = useState("");
  // Link vindo do Diagnóstico (/campaigns?id=...) já abre a campanha certa.
  // Só renderiza no navegador (depende dos dados da Meta), então window existe.
  const [selectedId, setSelectedId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("id"),
  );
  const campaigns = data.campanhas;
  const currency = data.conta.currency;

  const counts = useMemo(
    () => ({
      todas: campaigns.length,
      ativas: campaigns.filter((c) => c.situacao === "ATIVA").length,
      pausadas: campaigns.filter((c) => c.situacao === "PAUSADA").length,
      atencao: campaigns.filter(needsAttention).length,
    }),
    [campaigns],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (pill === "ativas" && c.situacao !== "ATIVA") return false;
      if (pill === "pausadas" && c.situacao !== "PAUSADA") return false;
      if (pill === "atencao" && !needsAttention(c)) return false;
      if (q) return c.name.toLowerCase().includes(q) || (c.objective || "").toLowerCase().includes(q);
      return true;
    });
  }, [campaigns, pill, search]);

  const selected = campaigns.find((c) => c.id === selectedId) ?? filtered[0] ?? null;

  const pills: { key: Pill; label: string }[] = [
    { key: "todas", label: "Todas" },
    { key: "ativas", label: "Ativas" },
    { key: "pausadas", label: "Pausadas" },
    { key: "atencao", label: "Precisam de você" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por situação">
          {pills.map((p) => (
            <button
              key={p.key}
              type="button"
              aria-pressed={pill === p.key}
              onClick={() => setPill(p.key)}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                pill === p.key
                  ? p.key === "atencao"
                    ? "border-warning/40 bg-warning-dim text-warning"
                    : "border-primary/40 bg-primary-dim text-primary"
                  : "border-border bg-input text-text-secondary hover:text-text-primary"
              }`}
            >
              {p.label}
              <span className="tabular-nums opacity-70">{counts[p.key]}</span>
            </button>
          ))}
        </div>

        <label className="relative w-full min-w-[220px] sm:w-64">
          <span className="sr-only">Buscar campanha</span>
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar campanha…"
            className={`${inputClass} w-full pl-9 pr-3 text-ellipsis`}
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <section
          aria-label="Lista de campanhas"
          className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card lg:col-span-5"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
            <span>Campanha</span>
            <span>Situação</span>
          </div>
          <ul className="max-h-[620px] flex-1 divide-y divide-border overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="p-6">
                <EmptyState
                  title="Nenhuma campanha encontrada"
                  description="Mude o filtro ou a busca."
                  action={{
                    label: "Limpar filtros",
                    onClick: () => {
                      setPill("todas");
                      setSearch("");
                    },
                  }}
                />
              </li>
            ) : (
              filtered.map((camp) => {
                const isSelected = camp.id === selected?.id;
                return (
                  <li key={camp.id}>
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setSelectedId(camp.id)}
                      className={`flex w-full items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${
                        isSelected ? "border-primary bg-primary-dim" : "border-transparent hover:bg-surface-2"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-foreground" title={camp.name}>
                          {camp.name}
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-text-secondary">
                          {objectiveLabel(camp.objective)} ·{" "}
                          {camp.daily_budget ? `${formatMoney(camp.daily_budget, currency, hide)}/dia` : "Orçamento no conjunto"}
                        </span>
                      </span>
                      <SituationPill situacao={camp.situacao} label={camp.situacaoLabel} />
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </section>

        <section aria-label="Detalhe da campanha" className="min-w-0 rounded-lg border border-border bg-card p-4 md:p-5 lg:col-span-7">
          {selected ? (
            <CampaignDetail
              key={selected.id}
              campaign={selected}
              accountName={data.conta.name}
              currency={currency}
              hide={hide}
              onUpdated={updateCampaign}
            />
          ) : (
            <EmptyState icon={Inbox} title="Selecione uma campanha" description="Escolha uma campanha na lista para ver os detalhes." />
          )}
        </section>
      </div>
    </div>
  );
}

function objectiveLabel(objective: string | undefined): string {
  const map: Record<string, string> = {
    OUTCOME_SALES: "Vendas",
    OUTCOME_LEADS: "Cadastros",
    OUTCOME_TRAFFIC: "Tráfego",
    OUTCOME_ENGAGEMENT: "Engajamento",
    OUTCOME_AWARENESS: "Reconhecimento",
    OUTCOME_APP_PROMOTION: "App",
  };
  if (!objective) return "Anúncios";
  return map[objective] ?? objective.replace("OUTCOME_", "").toLowerCase();
}

type Feedback = { text: string; type: "success" | "error" } | null;

function CampaignDetail({
  campaign,
  accountName,
  currency,
  hide,
  onUpdated,
}: {
  campaign: MetaCampaign;
  accountName: string;
  currency: string;
  hide: boolean;
  onUpdated: (id: string, patch: Partial<MetaCampaign>) => void;
}) {
  const [budgetInput, setBudgetInput] = useState(campaign.daily_budget ? campaign.daily_budget.toFixed(2) : "");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const isActive = campaign.status === "ACTIVE";

  useEffect(() => {
    if (!feedback) return;
    const id = window.setTimeout(() => setFeedback(null), 4000);
    return () => window.clearTimeout(id);
  }, [feedback]);

  async function postCampaign(body: Record<string, unknown>): Promise<string | null> {
    try {
      const res = await fetch("/api/meta/campanha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: campaign.id, ...body }),
      });
      const json = (await res.json().catch(() => ({}))) as { success?: boolean; error?: string };
      if (res.ok && json.success) return null;
      return json.error || "A Meta recusou a alteração";
    } catch {
      return "Falha de conexão com a Meta";
    }
  }

  async function handleToggleStatus() {
    const newStatus = isActive ? "PAUSED" : "ACTIVE";
    setIsUpdatingStatus(true);
    setFeedback(null);
    const error = await postCampaign({ status: newStatus });
    setIsUpdatingStatus(false);
    if (error) {
      setFeedback({ text: error, type: "error" });
      return;
    }
    const nowActive = newStatus === "ACTIVE";
    onUpdated(campaign.id, {
      status: newStatus,
      effective_status: newStatus,
      situacao: nowActive ? (campaign.spend > 0 ? "ATIVA" : "SEM_ENTREGA") : "PAUSADA",
      situacaoLabel: nowActive ? (campaign.spend > 0 ? "Ativa" : "Sem entrega") : "Pausada",
    });
    setFeedback({ text: nowActive ? "Campanha ativada na Meta." : "Campanha pausada na Meta.", type: "success" });
  }

  async function handleSaveBudget() {
    const value = Number(budgetInput.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      setFeedback({ text: "Informe um valor maior que zero.", type: "error" });
      return;
    }
    setIsSavingBudget(true);
    setFeedback(null);
    const error = await postCampaign({ daily_budget: value });
    setIsSavingBudget(false);
    if (error) {
      setFeedback({ text: error, type: "error" });
      return;
    }
    onUpdated(campaign.id, { daily_budget: value });
    setFeedback({ text: `Orçamento diário agora é ${formatMoney(value, currency)}.`, type: "success" });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-border pb-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold leading-snug text-foreground">{campaign.name}</h2>
          <p className="mt-0.5 truncate text-xs text-text-secondary">
            {objectiveLabel(campaign.objective)} · {accountName}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <SituationPill situacao={campaign.situacao} label={campaign.situacaoLabel} />
          <Button
            onClick={() => void handleToggleStatus()}
            loading={isUpdatingStatus}
            variant={isActive ? "secondary" : "roi"}
            size="sm"
          >
            {isActive ? "Pausar" : "Ativar"}
          </Button>
        </div>
      </div>

      {feedback && (
        <p
          role={feedback.type === "error" ? "alert" : "status"}
          className={`rounded-lg border p-3 text-sm ${
            feedback.type === "success" ? "border-primary/30 bg-primary-dim text-primary" : "border-danger/30 bg-danger-dim text-danger"
          }`}
        >
          {feedback.text}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 p-3">
        <div className="text-sm">
          <span className="font-semibold text-text-primary">Orçamento diário</span>
          <span className="ml-2 text-xs text-text-muted">{campaign.budgetType}</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="relative">
            <span className="sr-only">Orçamento diário</span>
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-text-muted">R$</span>
            <input
              type="text"
              inputMode="decimal"
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              placeholder="0,00"
              className={`${inputClass} w-28 pl-9 pr-2.5 font-semibold tabular-nums`}
            />
          </label>
          <Button onClick={() => void handleSaveBudget()} loading={isSavingBudget} variant="roi" size="sm">
            Salvar na Meta
          </Button>
        </div>
      </div>

      <Tabs defaultValue="resumo">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="conjuntos" className="gap-1.5">
            Conjuntos <span className="tabular-nums text-text-muted">{campaign.adsets.length}</span>
          </TabsTrigger>
          <TabsTrigger value="anuncios" className="gap-1.5">
            Anúncios <span className="tabular-nums text-text-muted">{campaign.ads.length}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Gasto" value={formatMoney(campaign.spend, currency, hide)} />
            <Stat label="Resultados" value={formatInteger(campaign.results, hide)} />
            <Stat label="Custo por resultado" value={campaign.results > 0 ? formatMoney(campaign.cpr, currency, hide) : "—"} />
            <Stat label="CTR do link" value={formatRate(campaign.ctr)} />
            <Stat label="CPM" value={formatMoney(campaign.cpm, currency, hide)} />
            <Stat label="Impressões" value={formatInteger(campaign.impressions, hide)} />
          </div>
        </TabsContent>

        <TabsContent value="conjuntos">
          <ul className="max-h-[360px] space-y-2 overflow-y-auto">
            {campaign.adsets.length === 0 ? (
              <li className="py-8 text-center text-xs text-text-muted">Nenhum conjunto encontrado.</li>
            ) : (
              campaign.adsets.map((adset) => (
                <li key={adset.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 p-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground" title={adset.name}>
                      {adset.name}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-text-secondary">
                      Fase: {adset.learning_stage} · Meta: {adset.optimization_goal}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <SituationPill situacao={adset.status === "ACTIVE" ? "ATIVA" : "PAUSADA"} label={adset.status === "ACTIVE" ? "Ativo" : "Pausado"} />
                    <p className="mt-1 text-xs font-semibold tabular-nums text-text-primary">
                      {adset.daily_budget ? `${formatMoney(adset.daily_budget, currency, hide)}/dia` : "Orçamento na campanha"}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </TabsContent>

        <TabsContent value="anuncios">
          <ul className="max-h-[360px] space-y-2 overflow-y-auto">
            {campaign.ads.length === 0 ? (
              <li className="py-8 text-center text-xs text-text-muted">Nenhum anúncio nesta campanha.</li>
            ) : (
              campaign.ads.map((ad) => (
                <li key={ad.id} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-2 p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    {ad.creative?.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element -- miniatura externa da Meta
                      <img
                        src={ad.creative.thumbnail_url}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-10 w-10 shrink-0 rounded-md border border-border bg-background object-cover"
                      />
                    ) : (
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-border bg-background text-[10px] text-text-muted">
                        —
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground" title={ad.name}>
                        {ad.name}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-text-secondary">{ad.creative?.title || "Sem título"}</p>
                    </div>
                  </div>
                  <SituationPill situacao={ad.status === "ACTIVE" ? "ATIVA" : "PAUSADA"} label={ad.status === "ACTIVE" ? "Ativo" : "Pausado"} />
                </li>
              ))
            )}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface-2 p-3">
      <p className="truncate text-[11px] font-semibold uppercase tracking-wider text-text-muted">{label}</p>
      <p className="mt-1 truncate text-base font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

