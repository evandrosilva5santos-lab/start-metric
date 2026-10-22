"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Info, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import type { InsightKind } from "@/lib/google-ads/insights-core";
import { InsightsTable } from "./InsightsTable";
import { KIND_CONFIG, withAgeOrder, type RowData } from "./insights-columns";

type GeoLevel = "country" | "region" | "city";
type GeoLocationType = "presence" | "interest";

type InsightResponse = {
  kind: InsightKind;
  rows: RowData[];
  fetchedAt: string;
  currency: string | null;
  notes: string[];
  truncated: boolean;
};

type Filters = { accountId: string; from: string; to: string; campaignId: string };
type Props = Filters & { kind: InsightKind; compare: boolean; showTitle?: boolean };

const FIVE_MINUTES = 5 * 60_000;
const DAY_MS = 86_400_000;

const GEO_LEVELS: Array<{ id: GeoLevel; label: string }> = [
  { id: "city", label: "Cidade" },
  { id: "region", label: "Estado / região" },
  { id: "country", label: "País" },
];

const GEO_TYPES: Array<{ id: GeoLocationType; label: string }> = [
  { id: "presence", label: "Onde estavam" },
  { id: "interest", label: "Local de interesse" },
];

const shift = (day: string, delta: number): string => new Date(Date.parse(`${day}T00:00:00Z`) + delta * DAY_MS).toISOString().slice(0, 10);

function previousRange(from: string, to: string): { from: string; to: string } {
  const span = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
  const prevTo = shift(from, -1);
  return { from: shift(prevTo, -(span - 1)), to: prevTo };
}

async function fetchInsight(kind: InsightKind, f: Filters, geo: { level: GeoLevel; locationType: GeoLocationType }): Promise<InsightResponse> {
  const params = new URLSearchParams({ kind, accountId: f.accountId, from: f.from, to: f.to, level: geo.level, locationType: geo.locationType });
  if (f.campaignId) params.set("campaignId", f.campaignId);
  const res = await fetch(`/api/google-ads/insights?${params}`);
  const body = (await res.json().catch(() => ({}))) as InsightResponse & { error?: string; detail?: string };
  if (!res.ok) throw new Error(body.error ?? `Erro ${res.status}`);
  return body;
}

const selectClass = "min-h-11 rounded-md border border-border bg-input px-2 text-sm text-fg lg:min-h-9";

export function InsightsPanel({ kind, accountId, from, to, campaignId, compare, showTitle = true }: Props) {
  const config = KIND_CONFIG[kind];
  const [level, setLevel] = useState<GeoLevel>("city");
  const [locationType, setLocationType] = useState<GeoLocationType>("presence");
  const geo = { level, locationType };

  const current = useQuery({
    queryKey: ["google-ads", "insights", kind, accountId, from, to, campaignId, level, locationType],
    queryFn: () => fetchInsight(kind, { accountId, from, to, campaignId }, geo),
    enabled: Boolean(accountId),
    staleTime: FIVE_MINUTES,
    retry: false,
    placeholderData: keepPreviousData,
  });

  const prevRange = previousRange(from, to);
  const previous = useQuery({
    queryKey: ["google-ads", "insights", kind, accountId, prevRange.from, prevRange.to, campaignId, level, locationType],
    queryFn: () => fetchInsight(kind, { accountId, from: prevRange.from, to: prevRange.to, campaignId }, geo),
    enabled: Boolean(accountId) && compare,
    staleTime: FIVE_MINUTES,
    retry: false,
  });

  const rows = useMemo(() => (kind === "age" ? withAgeOrder(current.data?.rows ?? []) : (current.data?.rows ?? [])), [kind, current.data]);
  const previousMap = useMemo(() => {
    if (!compare || !previous.data) return undefined;
    const prevRows = kind === "age" ? withAgeOrder(previous.data.rows) : previous.data.rows;
    return new Map(prevRows.map((r) => [config.rowKey(r), r]));
  }, [compare, previous.data, kind, config]);

  return (
    <section className="space-y-3" aria-label={config.title}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        {showTitle && <h2 className="font-display text-lg font-semibold text-fg">{config.title}</h2>}
        {kind === "locations" && (
          <div className="flex flex-wrap gap-2">
            <select aria-label="Nível da localidade" value={level} onChange={(e) => setLevel(e.target.value as GeoLevel)} className={selectClass}>
              {GEO_LEVELS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
            <select aria-label="Tipo de localização" value={locationType} onChange={(e) => setLocationType(e.target.value as GeoLocationType)} className={selectClass}>
              {GEO_TYPES.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {current.data && (
          <p className="text-xs text-fg-muted">
            Dados do Google às {new Date(current.data.fetchedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </p>
        )}
      </div>

      {!accountId ? (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-text-secondary">Escolha uma conta do Google Ads para ver esta análise.</p>
      ) : current.isPending ? (
        <div className="h-56 animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none" aria-busy="true" />
      ) : current.isError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-danger/30 bg-danger-tint p-4 text-sm text-danger">
          <span>{current.error.message}</span>
          <Button size="sm" variant="outline" onClick={() => current.refetch()} loading={current.isFetching}>
            <RefreshCw /> Tentar de novo
          </Button>
        </div>
      ) : (
        <>
          {current.data.notes.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-border bg-muted/40 p-3 text-xs text-text-secondary">
              {current.data.notes.map((note) => (
                <li key={note} className="flex gap-2">
                  <Info size={14} aria-hidden="true" className="mt-0.5 shrink-0 text-fg-muted" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          )}
          {compare && previous.isError && <p className="text-xs text-warning">Não foi possível carregar o período anterior para comparar.</p>}
          <div className={current.isFetching ? "opacity-70 transition-opacity" : undefined}>
            <InsightsTable
              key={`${kind}|${level}|${locationType}|${accountId}`}
              rows={rows}
              columns={config.columns}
              currency={current.data.currency ?? "BRL"}
              defaultSort={config.defaultSort}
              searchFields={config.searchFields}
              rowKey={config.rowKey}
              fileName={`${config.fileName}-${from}_${to}`}
              emptyMessage={config.emptyMessage}
              previous={previousMap}
            />
          </div>
        </>
      )}
    </section>
  );
}
