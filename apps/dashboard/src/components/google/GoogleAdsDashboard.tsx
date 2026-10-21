"use client";

import { useState } from "react";
import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link2 } from "lucide-react";
import { Kpi } from "@/components/ui/StatCard";
import { SectionCard, VariationBadge, type VariationSense } from "@/components/meta/MetaUi";
import { useMounted } from "@/hooks/useMounted";
import { AXIS_COLOR, CHART_SERIES, GRID_COLOR, TOOLTIP_CONTENT_STYLE, TOOLTIP_LABEL_STYLE } from "@/lib/chart-theme";
import { formatDecimal, formatInteger, formatMoney, formatRate, formatRatio } from "@/lib/format";
import type { MetricSummary } from "@/lib/google-ads/gaql";
import type { GoogleReport } from "@/lib/google-ads/report";

type Preset = "7d" | "14d" | "30d" | "month" | "last_month";

const PRESETS: Array<{ id: Preset; label: string }> = [
  { id: "7d", label: "7 dias" },
  { id: "14d", label: "14 dias" },
  { id: "30d", label: "30 dias" },
  { id: "month", label: "Este mês" },
  { id: "last_month", label: "Mês passado" },
];

const TIMEZONE = "America/Sao_Paulo";

const CHANNEL: Record<string, string> = {
  SEARCH: "Pesquisa",
  DISPLAY: "Display",
  SHOPPING: "Shopping",
  VIDEO: "Vídeo",
  PERFORMANCE_MAX: "Performance Max",
  DEMAND_GEN: "Demand Gen",
  MULTI_CHANNEL: "App",
  LOCAL: "Local",
  SMART: "Inteligente",
};

const STATUS: Record<string, { label: string; className: string }> = {
  ENABLED: { label: "Ativa", className: "bg-success-tint text-success" },
  PAUSED: { label: "Pausada", className: "bg-muted text-muted-foreground" },
};

function todayIn(timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

function rangeFor(preset: Preset): { from: string; to: string } {
  const today = todayIn(TIMEZONE);
  const yesterday = shiftDay(today, -1);
  const monthStart = `${today.slice(0, 8)}01`;
  switch (preset) {
    case "14d":
      return { from: shiftDay(yesterday, -13), to: yesterday };
    case "30d":
      return { from: shiftDay(yesterday, -29), to: yesterday };
    case "month":
      return { from: monthStart, to: today };
    case "last_month":
      return { from: `${shiftDay(monthStart, -1).slice(0, 8)}01`, to: shiftDay(monthStart, -1) };
    default:
      return { from: shiftDay(yesterday, -6), to: yesterday };
  }
}

function variation(current: number | null, previous: number | null): number | undefined {
  if (current === null || previous === null || previous === 0) return undefined;
  return ((current - previous) / previous) * 100;
}

function formatDay(day: string): string {
  return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
}

function formatConversions(value: number): string {
  return formatDecimal(value, value % 1 === 0 ? 0 : 1);
}

type KpiDef = { label: string; key: keyof MetricSummary; format: (v: number) => string; sense: VariationSense; emphasis?: boolean };

function kpis(currency: string): KpiDef[] {
  const money = (v: number) => formatMoney(v, currency);
  return [
    { label: "Investimento", key: "spend", format: money, sense: "neutral", emphasis: true },
    { label: "Impressões", key: "impressions", format: (v) => formatInteger(v), sense: "good" },
    { label: "Cliques", key: "clicks", format: (v) => formatInteger(v), sense: "good" },
    { label: "CTR", key: "ctr", format: (v) => formatRate(v), sense: "good" },
    { label: "CPC médio", key: "cpc", format: money, sense: "bad" },
    { label: "Conversões", key: "conversions", format: formatConversions, sense: "good" },
    { label: "Custo por conversão", key: "costPerConversion", format: money, sense: "bad" },
    { label: "ROAS", key: "roas", format: (v) => formatRatio(v), sense: "good" },
  ];
}

const show = (value: number | null, format: (v: number) => string): string => (value === null ? "—" : format(value));

export function GoogleAdsDashboard() {
  const [preset, setPreset] = useState<Preset>("7d");
  const [clientId, setClientId] = useState("");
  const [accountId, setAccountId] = useState("");
  const range = rangeFor(preset);
  const mounted = useMounted();

  const report = useQuery({
    queryKey: ["google-ads", "report", range.from, range.to, clientId, accountId],
    queryFn: async () => {
      const params = new URLSearchParams(range);
      if (clientId) params.set("clientId", clientId);
      if (accountId) params.set("accountId", accountId);
      const res = await fetch(`/api/google-ads/report?${params}`, { cache: "no-store" });
      const body = (await res.json().catch(() => ({}))) as GoogleReport & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `Erro ${res.status}`);
      return body;
    },
    placeholderData: keepPreviousData,
  });

  const data = report.data;
  const activeAccounts = data?.accounts.filter((a) => a.status === "active") ?? [];
  const accountOptions = activeAccounts.filter((a) => !clientId || a.clientId === clientId);
  const lastSync = activeAccounts.map((a) => a.lastSyncedAt).filter(Boolean).sort().at(-1) ?? null;
  const toBr = (day: string) => day.split("-").reverse().join("/");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">Google Ads</h1>
          <p className="mt-1 text-sm text-text-secondary">
            {toBr(range.from)} a {toBr(range.to)}
            {lastSync &&
              ` · atualizado ${new Date(lastSync).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Cliente"
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setAccountId("");
            }}
            className="min-h-11 rounded-md border border-border bg-input px-2 text-sm text-fg lg:min-h-9"
          >
            <option value="">Todos os clientes</option>
            {data?.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Conta"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="min-h-11 max-w-[240px] rounded-md border border-border bg-input px-2 text-sm text-fg lg:min-h-9"
          >
            <option value="">Todas as contas</option>
            {accountOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div role="group" aria-label="Período" className="flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
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

      {report.isError && (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-tint p-4 text-sm text-danger">
          {report.error.message}
        </div>
      )}

      {data && activeAccounts.length === 0 ? (
        <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-8 text-center">
          <Link2 className="mx-auto text-primary" size={28} />
          <h2 className="mt-3 font-display text-lg font-semibold text-foreground">Nenhuma conta Google Ads no painel</h2>
          <p className="mt-1 text-sm text-text-secondary">Conecte o Google Ads da agência e escolha as contas que devem aparecer aqui.</p>
          <Link
            href="/settings/google"
            className="mt-5 inline-flex h-11 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary-hover"
          >
            Conectar Google Ads
          </Link>
        </div>
      ) : !data ? (
        report.isError ? null : (
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4" aria-busy="true" aria-label="Carregando Google Ads">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-[96px] animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none" />
            ))}
          </div>
        )
      ) : (
        <>
          <div className={`grid grid-cols-2 gap-3 xl:grid-cols-4 ${report.isFetching ? "opacity-70" : ""}`}>
            {kpis(data.currency).map((k) => (
              <Kpi
                key={k.key}
                label={k.label}
                value={show(data.summary[k.key], k.format)}
                emphasis={k.emphasis}
                detail={`antes: ${show(data.previousSummary[k.key], k.format)}`}
                badge={<VariationBadge value={variation(data.summary[k.key], data.previousSummary[k.key])} sense={k.sense} />}
              />
            ))}
          </div>

          <SectionCard title="Evolução diária" subtitle="Investimento e conversões por dia">
            <div className="h-64">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={formatDay} stroke={AXIS_COLOR} fontSize={12} tickLine={false} />
                    <YAxis yAxisId="spend" stroke={AXIS_COLOR} fontSize={12} tickLine={false} width={72} tickFormatter={(v: number) => formatMoney(v, data.currency)} />
                    <YAxis yAxisId="conv" orientation="right" stroke={AXIS_COLOR} fontSize={12} tickLine={false} width={36} />
                    <Tooltip
                      contentStyle={TOOLTIP_CONTENT_STYLE}
                      labelStyle={TOOLTIP_LABEL_STYLE}
                      labelFormatter={(d) => formatDay(String(d))}
                      formatter={(value, name) => (name === "Investimento" ? formatMoney(Number(value), data.currency) : formatConversions(Number(value)))}
                    />
                    <Area yAxisId="spend" type="monotone" dataKey="spend" name="Investimento" stroke={CHART_SERIES[0]} fill={CHART_SERIES[0]} fillOpacity={0.15} strokeWidth={2} />
                    <Area yAxisId="conv" type="monotone" dataKey="conversions" name="Conversões" stroke={CHART_SERIES[1]} fill={CHART_SERIES[1]} fillOpacity={0.08} strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Campanhas" subtitle={`${data.campaigns.length} campanhas · ordenadas por investimento`}>
            {data.campaigns.length === 0 ? (
              <p className="rounded-md bg-surface-2 p-6 text-center text-sm text-fg-muted">
                Ainda não há campanhas sincronizadas. Use “Sincronizar agora” em Integrações → Google Ads.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-fg-muted">
                      <th className="py-2 pr-3 font-semibold">Campanha</th>
                      <th className="py-2 pr-3 text-right font-semibold">Investimento</th>
                      <th className="py-2 pr-3 text-right font-semibold">Cliques</th>
                      <th className="py-2 pr-3 text-right font-semibold">CTR</th>
                      <th className="py-2 pr-3 text-right font-semibold">CPC</th>
                      <th className="py-2 pr-3 text-right font-semibold">Conversões</th>
                      <th className="py-2 pr-3 text-right font-semibold">Custo/conv.</th>
                      <th className="py-2 text-right font-semibold">ROAS</th>
                    </tr>
                  </thead>
                  <tbody className="tabular-nums">
                    {data.campaigns.map((c) => {
                      const status = STATUS[c.status ?? ""];
                      const money = (v: number) => formatMoney(v, data.currency);
                      return (
                        <tr key={`${c.accountName}-${c.campaignId}`} className="border-b border-border last:border-0">
                          <td className="max-w-[320px] py-2.5 pr-3">
                            <p className="truncate font-medium text-fg" title={c.name}>
                              {c.name}
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-fg-muted">
                              {status && <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${status.className}`}>{status.label}</span>}
                              <span>{CHANNEL[c.channelType ?? ""] ?? c.channelType ?? "—"}</span>
                              {c.dailyBudget !== null && <span>· {money(c.dailyBudget)}/dia</span>}
                              {!accountId && <span className="truncate">· {c.accountName}</span>}
                            </p>
                          </td>
                          <td className="py-2.5 pr-3 text-right font-semibold text-fg">{money(c.metrics.spend)}</td>
                          <td className="py-2.5 pr-3 text-right">{formatInteger(c.metrics.clicks)}</td>
                          <td className="py-2.5 pr-3 text-right">{show(c.metrics.ctr, (v) => formatRate(v))}</td>
                          <td className="py-2.5 pr-3 text-right">{show(c.metrics.cpc, money)}</td>
                          <td className="py-2.5 pr-3 text-right">{formatConversions(c.metrics.conversions)}</td>
                          <td className="py-2.5 pr-3 text-right">{show(c.metrics.costPerConversion, money)}</td>
                          <td className="py-2.5 text-right">{show(c.metrics.roas, (v) => formatRatio(v))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {data.truncated && <p className="mt-3 text-xs text-warning">Período muito grande: parte das linhas não foi somada. Reduza o período.</p>}
          </SectionCard>
        </>
      )}
    </div>
  );
}
