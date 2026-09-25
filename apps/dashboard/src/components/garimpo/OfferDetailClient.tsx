"use client";

import Link from "next/link";
import { AlertTriangle, ArrowLeft, ArrowRight, Eye, Info, Layers } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { KpiTile, SectionCard } from "@/components/meta/MetaUi";
import { formatInteger } from "@/lib/format";
import type { OfferSignals } from "@/lib/garimpo/score";
import type { OfferDetailView } from "@/lib/garimpo/view-types";
import { DASH, fmtCount, fmtDate, fmtDateTime, fmtDayKey, fmtDays, fmtScore } from "./format";
import { OfferActions, STATUS_LABELS, ScanStatusStrip, Thumb } from "./parts";

const CHART_COLOR = "#44d5a4";
const GRID_COLOR = "#1c1f1e";
const AXIS_COLOR = "#656766";

export function OfferDetailClient({ data, generatedAt }: { data: OfferDetailView; generatedAt: string }) {
  const { offer, signals } = data;
  const repeatedValue = signals.pageCount > 0 ? `${formatInteger(signals.pagesWithRepeatedCreative)} de ${formatInteger(signals.pageCount)}` : DASH;
  const showRunProblem = data.latestRun && !["ok", "running"].includes(data.latestRun.status);

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <Link
          href="/garimpo"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={16} aria-hidden="true" /> Garimpo
        </Link>
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="break-all font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">{offer.domain}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-text-secondary">
              <span>{STATUS_LABELS[offer.status].replace(/s$/, "")}</span>
              <span>Visto desde {fmtDate(offer.firstSeenAt)}</span>
              <span className="tabular-nums">
                Score de sinal <strong className="text-primary">{fmtScore(offer.score)}</strong>
              </span>
              {offer.watch && (
                <span className="inline-flex items-center gap-1 text-primary">
                  <Eye size={14} aria-hidden="true" /> Revisitada todo dia
                </span>
              )}
              {data.divergent && (
                <span className="inline-flex items-center gap-1 rounded-full border border-warning/25 bg-warning-dim px-2 py-0.5 text-xs font-semibold text-warning">
                  <AlertTriangle size={12} aria-hidden="true" /> Domínio divergente
                </span>
              )}
            </p>
          </div>
          <div className="md:max-w-sm">
            <OfferActions offerId={offer.id} domain={offer.domain} status={offer.status} divergent={data.divergent} />
          </div>
        </div>
        {showRunProblem && (
          <ScanStatusStrip latestRun={data.latestRun} lastGoodRun={data.lastGoodRun} generatedAt={generatedAt} pendingSince={null} />
        )}
      </header>

      <section aria-label="Sinais" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Anúncios no ar" value={fmtCount(signals.activeAds)} hint={`${formatInteger(signals.totalAds)} vistos no total`} />
        <KpiTile label="Mais antigo no ar" value={fmtDays(signals.oldestActiveDays)} hint="Indício de que se paga" />
        <KpiTile label="Novos em 14 dias" value={fmtCount(signals.new14d)} hint="Indício de que está escalando" emphasis />
        <KpiTile label="Criativo repetido" value={repeatedValue} hint="Páginas com a mesma peça (blindagem)" />
      </section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <DailyActiveChart daily={data.daily} newPageDays={data.newPageDays} className="xl:col-span-2" />
        <InsightPanel signals={signals} divergent={data.divergent} watch={offer.watch} />
      </div>

      <SectionCard title="Páginas que apontam para o domínio" subtitle="Páginas são descartáveis; o domínio é o negócio.">
        <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-text-muted">
                <th scope="col" className="py-2 pr-4 font-semibold">Página</th>
                <th scope="col" className="py-2 pr-4 font-semibold">ID da página</th>
                <th scope="col" className="py-2 pr-4 font-semibold">Vista desde</th>
                <th scope="col" className="py-2 pr-4 text-right font-semibold">No ar</th>
                <th scope="col" className="py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.pages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-text-muted">
                    Nenhuma página registrada.
                  </td>
                </tr>
              ) : (
                data.pages.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="max-w-[240px] truncate py-3 pr-4 font-medium text-foreground">{p.pageName ?? DASH}</td>
                    <td className="py-3 pr-4 tabular-nums text-text-secondary">{p.pageIdMeta}</td>
                    <td className="py-3 pr-4 tabular-nums text-text-secondary">{fmtDate(p.firstSeenAt)}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-foreground">{formatInteger(p.activeAds)}</td>
                    <td className="py-3 text-right tabular-nums text-text-secondary">{formatInteger(p.totalAds)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Cadeia de redirecionamento" subtitle="Seguida no servidor, salto a salto, a partir do link do anúncio.">
        {data.chains.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhum link verificado ainda.</p>
        ) : (
          <ul className="space-y-3">
            {data.chains.map((c) => (
              <li key={c.rawLink} className={`rounded-lg border p-3 ${c.divergent ? "border-warning/40 bg-warning-dim" : "border-border bg-surface-2"}`}>
                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                  {c.divergent ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-warning">
                      <AlertTriangle size={12} aria-hidden="true" /> Exibe {c.displayedDomain ?? DASH}, termina em {c.resolvedDomain ?? DASH}
                    </span>
                  ) : (
                    <span className="font-semibold text-text-secondary">Termina em {c.resolvedDomain ?? DASH}</span>
                  )}
                  <span className="text-text-muted">· verificado {fmtDateTime(c.checkedAt)}</span>
                  {c.error && <span className="text-warning">· {c.error}</span>}
                </div>
                <ol className="space-y-1">
                  {(c.chain.length ? c.chain : [c.rawLink]).map((url, i) => (
                    <li key={`${i}-${url}`} className="flex min-w-0 items-start gap-2 text-xs">
                      <span className="w-5 shrink-0 pt-0.5 text-right tabular-nums text-text-muted">{i + 1}</span>
                      {i > 0 && <ArrowRight size={12} className="mt-0.5 shrink-0 text-text-muted" aria-hidden="true" />}
                      <span className="min-w-0 break-all font-mono text-text-primary">{url}</span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Criativos" subtitle="Agrupados pela mesma peça. O selo marca peças em mais de uma página.">
        {data.creatives.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhum criativo capturado.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-6">
            {data.creatives.map((c) => (
              <li key={c.key} className="relative flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-background">
                {c.mediaUrl ? (
                  <Thumb src={c.mediaUrl} className="aspect-square w-full" />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center bg-surface-2 p-3 text-center text-xs text-text-muted">
                    <span className="line-clamp-5">{c.bodyText ?? "Sem imagem"}</span>
                  </div>
                )}
                {c.pageCount > 1 && (
                  <span
                    className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full border border-primary/40 bg-background/90 px-2 py-0.5 text-[11px] font-bold tabular-nums text-primary"
                    title={c.kind === "fingerprint" ? "Comparação por texto/arquivo: sinal mais fraco que por imagem" : "Mesma imagem (hash perceptual)"}
                  >
                    <Layers size={11} aria-hidden="true" /> {c.pageCount} páginas{c.kind === "fingerprint" ? " · texto" : ""}
                  </span>
                )}
                <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-[11px] text-text-muted">
                  <span className="tabular-nums">{c.adCount === 1 ? "1 anúncio" : `${formatInteger(c.adCount)} anúncios`}</span>
                  <span>{c.format ?? DASH}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function DailyActiveChart({
  daily,
  newPageDays,
  className,
}: {
  daily: OfferDetailView["daily"];
  newPageDays: string[];
  className?: string;
}) {
  const points = daily.map((d) => ({ label: fmtDayKey(d.day), activeAds: d.activeAds }));
  const measured = daily.filter((d) => d.activeAds !== null).length;
  return (
    <SectionCard title="Anúncios no ar, dia a dia" subtitle="Linhas verticais: dia em que uma página nova apareceu." className={className}>
      <div className="h-64 w-full min-w-0">
        {measured === 0 ? (
          <p className="flex h-full items-center justify-center text-center text-sm text-text-muted">
            A curva começa na primeira leitura e cresce um ponto por dia depois de aprovada.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="garimpoFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={CHART_COLOR} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={CHART_COLOR} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={GRID_COLOR} vertical={false} />
              <XAxis dataKey="label" stroke={AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} minTickGap={16} />
              <YAxis stroke={AXIS_COLOR} fontSize={11} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
              <Tooltip
                cursor={{ stroke: AXIS_COLOR, strokeDasharray: "3 3" }}
                contentStyle={{ backgroundColor: "#0b100e", border: "1px solid #1c1f1e", borderRadius: 8, color: "#eaefee", fontSize: 12 }}
                labelStyle={{ color: "#9ba09e" }}
                formatter={(v) => [v === null || v === undefined ? DASH : formatInteger(Number(v)), "Anúncios no ar"]}
              />
              {newPageDays.map((day) => (
                <ReferenceLine
                  key={day}
                  x={fmtDayKey(day)}
                  stroke={AXIS_COLOR}
                  strokeDasharray="4 4"
                  label={{ value: "página nova", position: "top", fill: AXIS_COLOR, fontSize: 10 }}
                />
              ))}
              <Area
                type="monotone"
                dataKey="activeAds"
                stroke={CHART_COLOR}
                strokeWidth={2}
                fill="url(#garimpoFill)"
                connectNulls
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </SectionCard>
  );
}

function InsightPanel({ signals, divergent, watch }: { signals: OfferSignals; divergent: boolean; watch: boolean }) {
  const lines: string[] = [];
  if (signals.activeAds > 0) {
    lines.push(
      `${formatInteger(signals.activeAds)} anúncios no ar em ${formatInteger(signals.pageCount)} ${signals.pageCount === 1 ? "página" : "páginas"}. Volume sozinho diz pouco: variações de posicionamento inflam a conta e marcas grandes sempre têm muitos.`,
    );
  } else {
    lines.push("Nenhum anúncio no ar na última leitura.");
  }
  if (signals.oldestActiveDays !== null) {
    lines.push(
      signals.oldestActiveDays >= 30
        ? `O anúncio mais antigo segue no ar há ${formatInteger(signals.oldestActiveDays)} dias: indício de que a oferta se paga.`
        : `O anúncio mais antigo tem ${formatInteger(signals.oldestActiveDays)} dias: ainda cedo para falar em oferta que se paga.`,
    );
  }
  if (signals.new14d !== null) {
    lines.push(
      signals.new14d > 0
        ? `${formatInteger(signals.new14d)} anúncios novos nos últimos 14 dias: sinal de que está escalando agora.`
        : "Nenhum anúncio novo nos últimos 14 dias: sem sinal de escala no momento.",
    );
  }
  if (signals.repeatedCreatives > 0) {
    lines.push(
      `A mesma peça aparece em ${formatInteger(signals.pagesWithRepeatedCreative)} de ${formatInteger(signals.pageCount)} páginas: blindagem, o sinal mais forte de um operador escalando uma oferta.`,
    );
  }
  if (divergent) lines.push("O domínio exibido não é onde o link termina. Confira a cadeia antes de aprovar.");
  if (!watch) lines.push("Aprove para o scraper próprio revisitar todo dia e a curva crescer.");

  return (
    <SectionCard title="Leitura" subtitle="Sinais públicos da Biblioteca de Anúncios">
      <ul className="space-y-2 text-sm text-text-primary">
        {lines.map((line) => (
          <li key={line} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <span>{line}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex gap-2 rounded-lg border border-warning/30 bg-warning-dim p-3 text-xs text-warning">
        <Info size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
        Isto não é ROI medido. São indícios de gasto a partir de anúncios públicos; ninguém fora da operação sabe o retorno real.
      </p>
    </SectionCard>
  );
}
