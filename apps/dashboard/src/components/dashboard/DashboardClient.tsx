"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDashboardFilters } from "@/store/dashboard-filters";
import { formatInteger, formatMoney, formatRate, formatRatio } from "@/lib/format";
import { KpiTile, MetaDataGate, PageHeading, SectionCard } from "@/components/meta/MetaUi";
import { AvisoList } from "@/components/meta/AvisoList";
import type { DadosResponse, DailyPoint } from "@/lib/meta/dados-types";

type SeriesKey = "spend" | "results" | "cpr";

const SERIES: { key: SeriesKey; label: string }[] = [
  { key: "spend", label: "Gasto" },
  { key: "results", label: "Resultados" },
  { key: "cpr", label: "Custo por resultado" },
];

const CHART_COLOR = "#44d5a4";
const GRID_COLOR = "#1c1f1e";
const AXIS_COLOR = "#656766";

export function DashboardClient() {
  return (
    <div className="space-y-6">
      <PageHeading title="Visão geral" subtitle="Como a conta está indo no período" />
      <MetaDataGate>{(data) => <Overview data={data} />}</MetaDataGate>
    </div>
  );
}

function Overview({ data }: { data: DadosResponse }) {
  const hide = useDashboardFilters((s) => s.hideValues);
  const { totais, variacoes, conta } = data;
  const money = (v: number) => formatMoney(v, conta.currency, hide);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Gasto" value={money(totais.spend)} hint="Investido no período" variation={variacoes.spend} />
        <KpiTile
          label={totais.primaryType ? `Resultados · ${totais.primaryType}` : "Resultados"}
          value={formatInteger(totais.results, hide)}
          hint="Conversões principais, sem duplicar"
          variation={variacoes.results}
          sense="good"
          emphasis
        />
        <KpiTile
          label="Custo por resultado"
          value={money(totais.cpr)}
          hint="Média do período"
          variation={variacoes.cpr}
          sense="bad"
        />
        {totais.revenue > 0 ? (
          <KpiTile label="ROAS" value={formatRatio(totais.roas, hide)} hint="Receita ÷ gasto" variation={variacoes.roas} sense="good" />
        ) : (
          <KpiTile label="ROAS" value="—" hint="Sem receita rastreada no pixel" />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat label="CTR do link" value={formatRate(totais.ctr)} />
        <MiniStat label="CPM" value={money(totais.cpm)} />
        <MiniStat label="Impressões" value={formatInteger(totais.impressions, hide)} />
        <MiniStat label="Cliques no link" value={formatInteger(totais.clicks, hide)} />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <DailyChart data={data.serieDiaria} currency={conta.currency} hide={hide} className="xl:col-span-8" />
        <Funnel data={data} hide={hide} className="xl:col-span-4" />
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
          {data.campanhas.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-muted">Nenhuma campanha no período.</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.campanhas.slice(0, 5).map((camp) => (
                <li key={camp.id} className="flex items-center gap-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground" title={camp.name}>
                      {camp.name}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {formatInteger(camp.results, hide)} resultados · {money(camp.cpr)} por resultado
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
          <AvisoList avisos={data.avisos.slice(0, 3)} compact />
        </SectionCard>
      </div>
    </div>
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
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}

function DailyChart({
  data,
  currency,
  hide,
  className,
}: {
  data: DailyPoint[];
  currency: string;
  hide: boolean;
  className?: string;
}) {
  const [series, setSeries] = useState<SeriesKey>("spend");
  const current = SERIES.find((s) => s.key === series)!;
  const format = (v: number) => (series === "results" ? formatInteger(v, hide) : formatMoney(v, currency, hide));

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
                tickFormatter={(v: number) => (hide ? "" : series === "results" ? formatInteger(v) : formatMoney(v, currency).replace(/,\d{2}$/, ""))}
              />
              <Tooltip
                cursor={{ stroke: AXIS_COLOR, strokeDasharray: "3 3" }}
                contentStyle={{ backgroundColor: "#0b100e", border: "1px solid #1c1f1e", borderRadius: 8, color: "#eaefee", fontSize: 12 }}
                labelStyle={{ color: "#9ba09e" }}
                formatter={(v) => [format(Number(v) || 0), current.label]}
              />
              <Area type="monotone" dataKey={series} stroke={CHART_COLOR} strokeWidth={2} fill="url(#dailyFill)" activeDot={{ r: 4 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

function Funnel({ data, hide, className }: { data: DadosResponse; hide: boolean; className?: string }) {
  const steps = data.funil.etapas;
  const gargalo = data.funil.gargalo;

  return (
    <SectionCard title="Funil" subtitle="Da impressão ao resultado" className={className}>
      <ol className="space-y-3">
        {steps.map((step, idx) => {
          // Cada barra mostra quanto da etapa anterior passou para esta.
          const width = idx === 0 ? 100 : Math.min(Math.max(step.pctAnterior, 2), 100);
          return (
            <li key={step.nome}>
              <div className="flex items-baseline justify-between gap-2 text-xs">
                <span className="truncate font-medium text-text-primary">{step.nome}</span>
                <span className="shrink-0 tabular-nums text-text-secondary">
                  <span className="font-semibold text-foreground">{formatInteger(step.valor, hide)}</span>
                  {idx > 0 && <span className="ml-1.5">{formatRate(step.pctAnterior, 1)}</span>}
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
          Gargalo: <span className={gargalo.etapa === "Nenhum" ? "text-primary" : "text-warning"}>{gargalo.etapa}</span>
        </p>
        <p className="mt-1 text-xs leading-relaxed text-text-secondary">{gargalo.explicacao}</p>
      </div>
    </SectionCard>
  );
}
