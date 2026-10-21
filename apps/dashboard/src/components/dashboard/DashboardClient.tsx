"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDashboardFilters } from "@/store/dashboard-filters";
import { formatInteger, formatMoney, formatRate, formatRatio } from "@/lib/format";
import { KpiTile, SectionCard } from "@/components/meta/MetaUi";
import { AvisoList } from "@/components/meta/AvisoList";
import { ClientCards } from "@/components/dashboard/ClientCards";
import type { ClientCardsModel } from "@/lib/dashboard/cards/layout";
import type { OverviewDailyPoint, OverviewModel } from "@/lib/dashboard/overview";
import type { FunnelModel } from "@/lib/dashboard/funnel";
import { AXIS_COLOR, CHART_COLOR, GRID_COLOR, TOOLTIP_CONTENT_STYLE, TOOLTIP_LABEL_STYLE } from "@/lib/chart-theme";

type SeriesKey = "spend" | "results" | "cpr";

const SERIES: { key: SeriesKey; label: string }[] = [
  { key: "spend", label: "Gasto" },
  { key: "results", label: "Resultados" },
  { key: "cpr", label: "Custo por resultado" },
];

const CURRENCY = "BRL";
const DASH = "—";

function orDash(value: number | null, format: (v: number) => string): string {
  return value === null ? DASH : format(value);
}

export function DashboardClient({ model, clientCards = null }: { model: OverviewModel; clientCards?: ClientCardsModel | null }) {
  const hide = useDashboardFilters((s) => s.hideValues);
  const money = (v: number | null) => orDash(v, (n) => formatMoney(n, CURRENCY, hide));

  return (
    <div className="space-y-6">
      {clientCards ? <ClientCards model={clientCards} /> : <OverviewKpis model={model} hide={hide} />}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <DailyChart data={model.daily} hide={hide} className="xl:col-span-8" />
        <Funnel funnel={model.funnel} hide={hide} className="xl:col-span-4" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <SectionCard
          title="Principais campanhas"
          subtitle="Ordenadas por situação e gasto"
          className="xl:col-span-7"
          action={
            <Link href="/campaigns" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline">
              Ver todas <ArrowRight size={13} />
            </Link>
          }
        >
          {model.topCampaigns.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">Nenhuma campanha com gasto no período.</p>
          ) : (
            <ul className="divide-y divide-border">
              {model.topCampaigns.map((camp) => (
                <li key={camp.id} className="flex items-center gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground" title={camp.name}>
                      {camp.name}
                    </p>
                    <p className="text-xs tabular-nums text-text-secondary">
                      {formatInteger(camp.conversions, hide)} resultados · {money(camp.cpa)} por resultado
                    </p>
                  </div>
                  <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-foreground">{money(camp.spend)}</span>
                  <SituationPill situacao={camp.situacao} label={camp.situacaoLabel} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Diagnóstico"
          subtitle="O que pede sua atenção agora"
          className="xl:col-span-5"
          action={
            <Link href="/diagnostico" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-primary hover:underline">
              Detalhes <ArrowRight size={13} />
            </Link>
          }
        >
          <AvisoList avisos={model.avisos} compact />
        </SectionCard>
      </div>
    </div>
  );
}

function OverviewKpis({ model, hide }: { model: OverviewModel; hide: boolean }) {
  const { kpis, variations } = model;
  const money = (v: number | null) => orDash(v, (n) => formatMoney(n, CURRENCY, hide));
  const integer = (v: number | null) => orDash(v, (n) => formatInteger(n, hide));

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Gasto" value={money(kpis.spend)} hint="Investido no período" variation={variations.spend} />
        <KpiTile
          label={model.primaryType ? `Resultados · ${model.primaryType}` : "Resultados"}
          value={integer(kpis.conversions)}
          hint={model.primaryType ? "Conversões principais, sem duplicar" : "Conversões registradas no período"}
          variation={variations.conversions}
          sense="good"
          emphasis
        />
        <KpiTile
          label="Custo por resultado"
          value={money(kpis.cpa)}
          hint={kpis.cpa === null ? "Sem resultado para dividir o gasto" : "Gasto ÷ resultados"}
          variation={variations.cpa}
          sense="bad"
        />
        <KpiTile
          label="ROAS"
          value={orDash(kpis.roas, (n) => formatRatio(n, hide))}
          hint={kpis.roas === null ? "Sem receita rastreada no pixel" : "Receita ÷ gasto"}
          variation={variations.roas}
          sense="good"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label={model.linkClicks ? "CTR do link" : "CTR"} value={orDash(kpis.ctr, (n) => formatRate(n))} />
        <MiniStat label="CPM" value={money(kpis.cpm)} />
        <MiniStat label="Impressões" value={integer(kpis.impressions)} />
        <MiniStat label={model.linkClicks ? "Cliques no link" : "Cliques"} value={integer(kpis.clicks)} />
      </div>
    </>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-card px-4 py-3">
      <p className="truncate text-xs font-medium text-text-secondary">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

export function SituationPill({ situacao, label }: { situacao: string; label: string }) {
  const tone =
    situacao === "ATIVA"
      ? "border-primary/25 bg-primary-dim text-primary"
      : situacao === "SEM_ENTREGA"
        ? "border-warning/25 bg-warning-dim text-warning"
        : "border-border bg-surface-2 text-text-secondary";
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[12px] font-semibold ${tone}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function DailyChart({ data, hide, className }: { data: OverviewDailyPoint[]; hide: boolean; className?: string }) {
  const [series, setSeries] = useState<SeriesKey>("spend");
  const current = SERIES.find((s) => s.key === series)!;
  const format = (v: number | null) =>
    v === null ? DASH : series === "results" ? formatInteger(v, hide) : formatMoney(v, CURRENCY, hide);

  return (
    <SectionCard
      title="Evolução diária"
      subtitle={`${current.label} dia a dia`}
      className={className}
      action={
        <div role="radiogroup" aria-label="Métrica do gráfico" className="flex shrink-0 rounded-lg border border-border bg-input p-0.5">
          {SERIES.map((s) => (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={series === s.key}
              onClick={() => setSeries(s.key)}
              className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                series === s.key ? "bg-primary-dim text-primary" : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {s.key === "cpr" ? "Custo/res." : s.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="h-64 w-full min-w-0">
        {data.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-text-muted">Sem dados diários no período.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="dailyFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLOR} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={CHART_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" stroke={AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis
                stroke={AXIS_COLOR}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={hide ? 24 : 64}
                tickFormatter={(v: number) =>
                  hide ? "" : series === "results" ? formatInteger(v) : formatMoney(v, CURRENCY).replace(/,\d{2}$/, "")
                }
              />
              <Tooltip
                cursor={{ stroke: AXIS_COLOR, strokeDasharray: "3 3" }}
                contentStyle={TOOLTIP_CONTENT_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                formatter={(v) => [format(v === null || v === undefined ? null : Number(v)), current.label]}
              />
              <Area
                type="monotone"
                dataKey={series}
                stroke={CHART_COLOR}
                strokeWidth={2}
                fill="url(#dailyFill)"
                activeDot={{ r: 4 }}
                connectNulls={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

function Funnel({ funnel, hide, className }: { funnel: FunnelModel; hide: boolean; className?: string }) {
  const { etapas, gargalo, aguardandoSync } = funnel;

  return (
    <SectionCard title="Funil" subtitle="Da impressão ao resultado" className={className}>
      <ol className="space-y-3">
        {etapas.map((step, idx) => {
          const width = step.valor === null ? 0 : idx === 0 ? 100 : Math.min(Math.max(step.pctAnterior ?? 0, 2), 100);
          return (
            <li key={step.nome}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate font-medium text-text-primary">{step.nome}</span>
                <span className="shrink-0 tabular-nums text-text-secondary">
                  <span className="font-semibold text-foreground">{orDash(step.valor, (n) => formatInteger(n, hide))}</span>
                  {idx > 0 && <span className="ml-1.5">{orDash(step.pctAnterior, (n) => formatRate(n, 1))}</span>}
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-primary" style={{ width: `${width}%` }} />
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 rounded-lg border border-border bg-surface-2 p-3">
        <p className="text-xs font-semibold text-foreground">
          Gargalo: <span className={gargalo.resolvido ? "text-primary" : gargalo.etapa === DASH ? "text-text-secondary" : "text-warning"}>{gargalo.etapa}</span>
        </p>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">{gargalo.explicacao}</p>
        {aguardandoSync && (
          <Link href="/settings/meta" className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
            Sincronizar em Integrações <ArrowRight size={13} aria-hidden="true" />
          </Link>
        )}
      </div>
    </SectionCard>
  );
}
