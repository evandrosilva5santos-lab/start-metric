"use client";

import { useMemo, useState } from "react";
import { useDashboardFilters } from "@/store/dashboard-filters";
import { formatInteger, formatMoney } from "@/lib/format";
import { MetaDataGate, PageHeading, SectionCard } from "@/components/meta/MetaUi";
import type { DadosResponse, HeatmapCell } from "@/lib/meta/dados-types";

type Metric = "spend" | "clicks" | "leads";

const METRICS: { key: Metric; label: string }[] = [
  { key: "spend", label: "Gasto" },
  { key: "clicks", label: "Cliques" },
  { key: "leads", label: "Resultados" },
];

const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const DAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);

// Escala sequencial de um só tom: o verde do tema, mais forte = mais atividade.
function cellColor(intensity: number): string {
  if (intensity <= 0) return "var(--color-surface-2)";
  const alpha = 0.14 + intensity * 0.86;
  return `rgba(68, 213, 164, ${alpha.toFixed(3)})`;
}

export function HorarioClient() {
  return (
    <div className="space-y-6">
      <PageHeading title="Horário" subtitle="Melhores dias e horas, no fuso da conta de anúncios" />
      <MetaDataGate>{(data) => <Heatmap data={data} />}</MetaDataGate>
    </div>
  );
}

type Hovered = { day: number; hour: number; cell: HeatmapCell } | null;

function Heatmap({ data }: { data: DadosResponse }) {
  const hide = useDashboardFilters((s) => s.hideValues);
  const [metric, setMetric] = useState<Metric>("spend");
  const [hovered, setHovered] = useState<Hovered>(null);
  const grid = data.heatmap;
  const currency = data.conta.currency;

  const format = (m: Metric, v: number) => (m === "spend" ? formatMoney(v, currency, hide) : formatInteger(v, hide));

  const { max, top } = useMemo(() => {
    const cells: { day: number; hour: number; value: number }[] = [];
    for (let d = 0; d < 7; d++) {
      for (let h = 0; h < 24; h++) {
        cells.push({ day: d, hour: h, value: grid[d]?.[h]?.[metric] ?? 0 });
      }
    }
    const maxValue = Math.max(0, ...cells.map((c) => c.value));
    const best = cells
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
    return { max: maxValue, top: best };
  }, [grid, metric]);

  const metricLabel = METRICS.find((m) => m.key === metric)!.label;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
      <SectionCard
        title="Mapa de calor"
        subtitle={`${metricLabel} por dia da semana e hora (${data.conta.timezone})`}
        className="xl:col-span-9"
        action={
          <div role="radiogroup" aria-label="Métrica do mapa" className="flex shrink-0 rounded-lg border border-border bg-input p-0.5">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={metric === m.key}
                onClick={() => setMetric(m.key)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                  metric === m.key ? "bg-primary-dim text-primary" : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        }
      >
        {max === 0 ? (
          <p className="py-10 text-center text-sm text-text-muted">Sem dados por hora no período.</p>
        ) : (
          <>
            <div className="overflow-x-auto pb-1">
              <div
                className="grid min-w-[640px] gap-[2px]"
                style={{ gridTemplateColumns: "44px repeat(24, minmax(0, 1fr))" }}
                onMouseLeave={() => setHovered(null)}
              >
                <span />
                {HOURS.map((h) => (
                  <span key={h} className="pb-1 text-center text-[10px] tabular-nums text-text-muted">
                    {h % 3 === 0 ? `${h}h` : ""}
                  </span>
                ))}
                {DAYS_SHORT.map((day, d) => (
                  <Row key={day} label={day}>
                    {HOURS.map((h) => {
                      const cell = grid[d]?.[h] ?? { spend: 0, clicks: 0, leads: 0, count: 0 };
                      const value = cell[metric];
                      const isHovered = hovered?.day === d && hovered.hour === h;
                      return (
                        <span
                          key={h}
                          onMouseEnter={() => setHovered({ day: d, hour: h, cell })}
                          title={`${DAYS[d]}, ${h}h · ${metricLabel}: ${format(metric, value)}`}
                          className={`aspect-square min-h-[18px] rounded-[3px] ${isHovered ? "ring-2 ring-foreground" : ""}`}
                          style={{ backgroundColor: cellColor(max > 0 ? value / max : 0) }}
                        />
                      );
                    })}
                  </Row>
                ))}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-text-secondary">
              <p aria-live="polite" className="min-h-[1.25rem] tabular-nums">
                {hovered ? (
                  <>
                    <span className="font-semibold text-foreground">
                      {DAYS[hovered.day]}, {hovered.hour}h
                    </span>{" "}
                    · Gasto {format("spend", hovered.cell.spend)} · Cliques {format("clicks", hovered.cell.clicks)} ·
                    {data.totais.primaryType} {format("leads", hovered.cell.leads)}
                  </>
                ) : (
                  "Toque ou passe o mouse num quadrado para ver os números. Por hora, os resultados contam todas as campanhas e a Meta arredonda o recorte, então a soma pode diferir um pouco do total."
                )}
              </p>
              <div className="flex items-center gap-2">
                <span>Menos</span>
                <span
                  aria-hidden="true"
                  className="h-2 w-28 rounded-full"
                  style={{ background: `linear-gradient(90deg, ${cellColor(0.01)}, ${cellColor(1)})` }}
                />
                <span>Mais</span>
              </div>
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard title="Melhores horários" subtitle={`Top 5 em ${metricLabel.toLowerCase()}`} className="xl:col-span-3">
        {top.length === 0 ? (
          <p className="text-sm text-text-muted">Sem dados.</p>
        ) : (
          <ol className="space-y-2">
            {top.map((c, i) => (
              <li key={`${c.day}-${c.hour}`} className="flex items-center gap-3 text-sm">
                <span className="w-4 shrink-0 text-xs font-semibold tabular-nums text-text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-foreground">
                  {DAYS[c.day]}, {c.hour}h
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-foreground">{format(metric, c.value)}</span>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <span className="flex items-center text-xs font-medium text-text-secondary">{label}</span>
      {children}
    </>
  );
}
