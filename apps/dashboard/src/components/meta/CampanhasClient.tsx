"use client";

import { useEffect, useMemo, useState } from "react";
import { Banknote, ChartColumn, Inbox, Search, Target, TrendingUp, type LucideIcon } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button, EmptyState, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { useDashboardFilters } from "@/store/dashboard-filters";
import { useMetaDados } from "@/hooks/useMetaDashboard";
import { formatInteger, formatMoney, formatRate } from "@/lib/format";
import { MetaDataGate, PageHeading } from "@/components/meta/MetaUi";
import { needsAttention } from "@/components/meta/DiagnosticoClient";
import { SituationPill } from "@/components/dashboard/DashboardClient";
import type { DadosResponse, DailyPoint, MetaCampaign } from "@/lib/meta/dados-types";

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
                          {objectiveLabel(camp.objective)}
                          {camp.budget ? ` · ${budgetText(camp.budget, currency, hide)}` : ""}
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

function budgetText(budget: NonNullable<MetaCampaign["budget"]>, currency: string, hide: boolean): string {
  const valor = formatMoney(budget.valor, currency, hide);
  return budget.periodo === "dia" ? `${valor}/dia` : `${valor} no total`;
}

const LEARNING_LABEL: Record<string, string> = {
  LEARNING: "aprendendo",
  FAIL: "aprendizado limitado",
  SUCCESS: "estável",
};

const RESULT_LABEL: Record<string, string> = { compra: "compra", lead: "lead", conversa: "conversa" };

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
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

      {campaign.budget?.onde === "conjuntos" ? (
        <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm">
          <span className="font-semibold text-text-primary">Orçamento: {budgetText(campaign.budget, currency, hide)}</span>
          <p className="mt-0.5 text-xs text-text-secondary">
            Soma dos {campaign.activeAdsets} conjunto(s) ligado(s). Nesta campanha o orçamento é definido em cada conjunto (aba Conjuntos).
          </p>
        </div>
      ) : (
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
      )}

      <Tabs defaultValue="resumo">
        <TabsList>
          <TabsTrigger value="resumo">Resumo</TabsTrigger>
          <TabsTrigger value="conjuntos" className="gap-1.5">
            Conjuntos <span className="tabular-nums text-text-muted">{campaign.adsets.length}</span>
          </TabsTrigger>
          <TabsTrigger value="anuncios" className="gap-1.5">
            Anúncios <span className="tabular-nums text-text-muted">{campaign.ads.length}</span>
          </TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo">
          <div className="grid grid-cols-2 gap-3">
            <Stat icon={Banknote} label="Gasto" value={formatMoney(campaign.spend, currency, hide)} hint="Investido no período" />
            <Stat
              icon={Target}
              label={campaign.resultType ? capitalize(campaign.resultLabel) : "Resultados"}
              value={campaign.resultType ? formatInteger(campaign.results, hide) : "—"}
              hint={campaign.resultType ? `O que ela otimiza, sem contar em dobro` : "Alcance/tráfego: não otimiza compra, lead nem conversa"}
            />
            <Stat
              icon={TrendingUp}
              label="Custo"
              value={campaign.results > 0 ? formatMoney(campaign.cpr, currency, hide) : "—"}
              hint={campaign.resultType ? `Gasto ÷ ${campaign.resultLabel}` : "Sem resultado para dividir"}
            />
            <Stat icon={ChartColumn} label="CTR" value={formatRate(campaign.ctr)} hint="De cada 100 que viram, quantos clicaram no link" />
          </div>
          <p className="mt-3 text-xs text-text-secondary">
            CPM {formatMoney(campaign.cpm, currency, hide)} · {formatInteger(campaign.impressions, hide)} impressões
            {campaign.frequency > 0 ? ` · cada pessoa viu ${campaign.frequency.toFixed(1).replace(".", ",")} vezes` : ""}
          </p>
          <CampaignSpendChart data={campaign.serieDiaria} currency={currency} hide={hide} />
        </TabsContent>

        <TabsContent value="historico">
          <CampaignHistory data={campaign.serieDiaria} campaign={campaign} currency={currency} hide={hide} />
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
                      {adset.resultType ? `Otimiza: ${RESULT_LABEL[adset.resultType]}` : "Não otimiza compra, lead nem conversa"}
                      {adset.effective_status === "ACTIVE" && LEARNING_LABEL[adset.learning_stage] ? ` · ${LEARNING_LABEL[adset.learning_stage]}` : ""}
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

function Stat({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface-2 p-3">
      <p className="flex items-center gap-1.5 truncate text-xs font-medium text-text-secondary">
        <Icon size={13} aria-hidden="true" className="shrink-0 text-primary" />
        {label}
      </p>
      <p className="mt-1.5 truncate font-display text-xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-text-muted">{hint}</p>
    </div>
  );
}

const CHART_COLOR = "#44d5a4";
const GRID_COLOR = "#1c1f1e";
const AXIS_COLOR = "#656766";

function CampaignSpendChart({ data, currency, hide }: { data: DailyPoint[]; currency: string; hide: boolean }) {
  const hasSpend = data.some((d) => d.spend > 0);
  return (
    <div className="mt-4">
      <p className="text-xs font-medium text-text-secondary">Gasto dia a dia</p>
      <div className="mt-2 h-44 w-full min-w-0">
        {!hasSpend ? (
          <p className="flex h-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-text-muted">
            Nenhum gasto no período.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="campaignSpendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLOR} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={CHART_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" stroke={AXIS_COLOR} fontSize={10} tickLine={false} axisLine={false} minTickGap={20} />
              <YAxis
                stroke={AXIS_COLOR}
                fontSize={10}
                tickLine={false}
                axisLine={false}
                width={hide ? 16 : 52}
                tickFormatter={(v: number) => (hide ? "" : formatMoney(v, currency).replace(/,\d{2}$/, ""))}
              />
              <Tooltip
                cursor={{ stroke: AXIS_COLOR, strokeDasharray: "3 3" }}
                contentStyle={{ backgroundColor: "#0b100e", border: "1px solid #1c1f1e", borderRadius: 8, color: "#eaefee", fontSize: 12 }}
                labelStyle={{ color: "#9ba09e" }}
                formatter={(v) => [formatMoney(Number(v) || 0, currency, hide), "Gasto"]}
              />
              <Area type="monotone" dataKey="spend" stroke={CHART_COLOR} strokeWidth={2} fill="url(#campaignSpendFill)" activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

/** Dia a dia da campanha, do mais recente para o mais antigo. Só dias com entrega. */
function CampaignHistory({ data, campaign, currency, hide }: { data: DailyPoint[]; campaign: MetaCampaign; currency: string; hide: boolean }) {
  const days = data.filter((d) => d.impressions > 0).slice().reverse();
  if (days.length === 0) {
    return <p className="py-8 text-center text-xs text-text-muted">Nenhum dia com entrega no período.</p>;
  }
  return (
    <div className="max-h-[360px] overflow-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <caption className="sr-only">Histórico diário de {campaign.name}</caption>
        <thead className="sticky top-0 bg-surface-2 text-[11px] uppercase tracking-wider text-text-muted">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Dia</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Gasto</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">{campaign.resultType ? capitalize(campaign.resultLabel) : "Resultados"}</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">Custo</th>
            <th scope="col" className="px-3 py-2 text-right font-semibold">CTR</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border tabular-nums">
          {days.map((d) => (
            <tr key={d.date ?? d.label}>
              <th scope="row" className="px-3 py-2 font-medium text-text-primary">{d.label}</th>
              <td className="px-3 py-2 text-right text-foreground">{formatMoney(d.spend, currency, hide)}</td>
              <td className="px-3 py-2 text-right text-foreground">{campaign.resultType ? formatInteger(d.results, hide) : "—"}</td>
              <td className="px-3 py-2 text-right text-foreground">{d.results > 0 ? formatMoney(d.cpr, currency, hide) : "—"}</td>
              <td className="px-3 py-2 text-right text-text-secondary">{formatRate(d.ctr)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

