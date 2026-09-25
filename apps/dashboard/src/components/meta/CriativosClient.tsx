"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Award, Image as ImageIcon, Play } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { useDashboardFilters } from "@/store/dashboard-filters";
import { formatInteger, formatMoney, formatRate } from "@/lib/format";
import { MetaDataGate, PageHeading } from "@/components/meta/MetaUi";
import type { DadosResponse, MetaCreative } from "@/lib/meta/dados-types";

type SortOption = "spend" | "results" | "hook" | "ctr" | "cpr";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "spend", label: "Maior gasto" },
  { value: "results", label: "Mais resultados" },
  { value: "hook", label: "Melhor gancho (3s)" },
  { value: "ctr", label: "Maior CTR" },
  { value: "cpr", label: "Menor custo por resultado" },
];

export function CriativosClient() {
  return (
    <div className="space-y-6">
      <PageHeading title="Criativos" subtitle="Gancho, retenção e sinais de cansaço de cada anúncio" />
      <MetaDataGate>{(data) => <Criativos data={data} />}</MetaDataGate>
    </div>
  );
}

function Criativos({ data }: { data: DadosResponse }) {
  const hide = useDashboardFilters((s) => s.hideValues);
  const [sort, setSort] = useState<SortOption>("spend");
  const avgCpr = data.totais.cpr;

  const creatives = useMemo(() => {
    const list = [...data.criativos];
    list.sort((a, b) => {
      if (sort === "results") return b.results - a.results;
      if (sort === "hook") return b.hookRate - a.hookRate;
      if (sort === "ctr") return b.ctr - a.ctr;
      if (sort === "cpr") return (a.cpr || Infinity) - (b.cpr || Infinity);
      return b.spend - a.spend;
    });
    return list;
  }, [data.criativos, sort]);

  if (creatives.length === 0) {
    return (
      <EmptyState
        icon={ImageIcon}
        title="Nenhum criativo com entrega"
        description="Nenhum anúncio teve impressões no período. Tente outro período no topo da página."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">
          <span className="font-semibold tabular-nums text-foreground">{creatives.length}</span> anúncios com entrega
        </p>
        <label className="flex items-center gap-2 text-xs text-text-secondary">
          Ordenar por
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            className="h-9 rounded-lg border border-border bg-input px-3 text-sm font-medium text-text-primary outline-none hover:border-white-hairline-strong focus-visible:ring-2 focus-visible:ring-ring"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ul className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {creatives.map((c) => (
          <CreativeCard key={c.id} creative={c} avgCpr={avgCpr} currency={data.conta.currency} hide={hide} />
        ))}
      </ul>
    </div>
  );
}

function CreativeCard({
  creative: c,
  avgCpr,
  currency,
  hide,
}: {
  creative: MetaCreative;
  avgCpr: number;
  currency: string;
  hide: boolean;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const isWinner = c.results > 15 && c.cpr < avgCpr;
  // Regra do painel: CTR caiu mais de 20% E CPM subiu mais de 10% contra o período anterior.
  const isFatigued = c.cansado;

  return (
    <li className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
      <div className="relative flex h-44 items-center justify-center border-b border-border bg-background">
        {c.thumbnail && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element -- miniatura externa da Meta
          <img
            src={c.thumbnail}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-text-muted">
            <ImageIcon size={16} /> Sem prévia
          </span>
        )}
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5">
          {isWinner && (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary-dim px-2 py-0.5 text-[11px] font-semibold text-primary">
              <Award size={12} /> Campeão
            </span>
          )}
          {isFatigued && (
            <span
              title="A taxa de clique caiu mais de 20% e o custo por mil exibições subiu mais de 10% contra o período anterior"
              className="inline-flex items-center gap-1 rounded-full border border-danger/40 bg-danger-dim px-2 py-0.5 text-[11px] font-semibold text-danger"
            >
              <AlertTriangle size={12} /> Cansado
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-foreground" title={c.name}>
            {c.name}
          </h3>
          <p className="mt-1 truncate text-xs text-text-muted" title={c.campaign_name}>
            {c.campaign_name || "Campanha"}
          </p>
        </div>

        <dl className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-surface-2 p-2.5 text-center">
          <Metric label="Gasto" value={formatMoney(c.spend, currency, hide)} />
          <Metric label={c.resultLabel} value={formatInteger(c.results, hide)} />
          <Metric label="CTR" value={formatRate(c.ctr)} />
        </dl>

        {c.isVideo && (
          <div className="space-y-2.5">
            <RateBar icon label="Prenderam 3 segundos" value={c.hookRate} />
            <RateBar label="Viram até o fim" value={c.retentionRate} />
            <p className="text-[11px] text-text-muted">Em % de quem recebeu o anúncio (impressões).</p>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between border-t border-border pt-3 text-xs">
          <span className="text-text-secondary">Custo por {c.resultLabel === "resultados" ? "resultado" : c.resultLabel.replace(/s$/, "")}</span>
          <span className="text-sm font-semibold tabular-nums text-foreground">
            {c.results > 0 ? formatMoney(c.cpr, currency, hide) : "—"}
          </span>
        </div>
      </div>
    </li>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function RateBar({ label, value, icon = false }: { label: string; value: number; icon?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-text-secondary">
        <span className="flex items-center gap-1">
          {icon && <Play size={10} className="text-primary" />}
          {label}
        </span>
        <span className="font-semibold tabular-nums text-foreground">{formatRate(value, 1)}</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
      </div>
    </div>
  );
}
