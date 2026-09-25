"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { AlertTriangle, Eye, Layers, Pickaxe, SlidersHorizontal } from "lucide-react";
import { saveCuts, startScan } from "@/app/(dashboard)/garimpo/actions";
import { KpiTile } from "@/components/meta/MetaUi";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { COMMERCIAL_COUNTRIES, SCAN_COUNTRIES } from "@/lib/garimpo/countries";
import type { Cut } from "@/lib/garimpo/score";
import type { SourceId } from "@/lib/garimpo/sources/types";
import type { GarimpoOverview, OfferCardView, OfferStatus } from "@/lib/garimpo/view-types";
import { fmtCount, fmtDays, fmtScore } from "./format";
import { Modal, OfferActions, STATUS_LABELS, ScanStatusStrip, Sparkline, Thumb } from "./parts";

const TAB_ORDER: OfferStatus[] = ["novo", "em_analise", "aprovado", "descartado"];

const FORMAT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "image", label: "Imagem" },
  { value: "video", label: "Vídeo" },
  { value: "carousel", label: "Carrossel" },
];

const fieldClass =
  "h-11 w-full rounded-lg border border-border bg-input px-3 text-sm text-foreground placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function GarimpoClient({ data, generatedAt }: { data: GarimpoOverview; generatedAt: string }) {
  const lastNiche = data.latestRun?.niche && data.latestRun.source !== "scraper_proprio" ? data.latestRun.niche : "";
  const [niche, setNiche] = useState(lastNiche);
  const [country, setCountry] = useState(data.latestRun?.country || "BR");
  const [source, setSource] = useState<SourceId>(data.latestRun?.source === "api_oficial" ? "api_oficial" : "terceiro");
  const [cutsOpen, setCutsOpen] = useState(false);
  const [tab, setTab] = useState<string>("novo");
  const [pendingSince, setPendingSince] = useState<number | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const byStatus = new Map<OfferStatus, OfferCardView[]>(TAB_ORDER.map((s) => [s, []]));
  for (const offer of data.offers) byStatus.get(offer.status)?.push(offer);

  const scan = (e: React.FormEvent) => {
    e.preventDefault();
    setScanError(null);
    setPendingSince(Date.now());
    startTransition(async () => {
      const result = await startScan({ niche, country, source });
      setPendingSince(null);
      if (!result.ok) setScanError(result.error);
    });
  };

  const apiOutsideEu = source === "api_oficial" && !COMMERCIAL_COUNTRIES.has(country);

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">Garimpo</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Quem está gastando de verdade num nicho, agrupado pelo domínio de destino. Sinais públicos, não ROI.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCutsOpen(true)}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 text-sm font-semibold text-text-primary transition-colors hover:bg-input focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none"
          >
            <SlidersHorizontal size={16} aria-hidden="true" /> Cortes
          </button>
        </div>

        <form onSubmit={scan} className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-card p-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Nicho ou palavra-chave</span>
            <input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="ex.: emagrecimento, renda extra" className={fieldClass} required minLength={2} maxLength={120} />
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-secondary">País</span>
            <select value={country} onChange={(e) => setCountry(e.target.value)} className={fieldClass}>
              {SCAN_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="min-w-0">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-secondary">Fonte</span>
            <select value={source} onChange={(e) => setSource(e.target.value as SourceId)} className={fieldClass}>
              <option value="terceiro">Terceiro (Apify)</option>
              <option value="api_oficial">API oficial</option>
              <option value="scraper_proprio">Scraper próprio (vigiadas)</option>
            </select>
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={pendingSince !== null}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 motion-reduce:transition-none md:w-auto"
            >
              <Pickaxe size={16} aria-hidden="true" /> Varrer
            </button>
          </div>
          {apiOutsideEu && (
            <p className="text-xs text-warning md:col-span-4">
              Fora da UE/Reino Unido a API oficial só devolve anúncios políticos. Para o Brasil, use Terceiro.
            </p>
          )}
          {source === "scraper_proprio" && (
            <p className="text-xs text-text-secondary md:col-span-4">
              O scraper próprio só revisita as páginas das ofertas aprovadas, devagar. Ele já roda sozinho todo dia.
            </p>
          )}
        </form>

        <ScanStatusStrip latestRun={data.latestRun} lastGoodRun={data.lastGoodRun} generatedAt={generatedAt} pendingSince={pendingSince} />
        {scanError && pendingSince === null && (
          <p role="alert" className="flex items-center gap-2 text-sm text-warning">
            <AlertTriangle size={14} aria-hidden="true" /> {scanError}
          </p>
        )}
        {data.loadError && (
          <p role="alert" className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-dim px-4 py-3 text-sm text-warning">
            <AlertTriangle size={16} aria-hidden="true" /> {data.loadError} Recarregue a página em instantes.
          </p>
        )}
      </header>

      <section aria-label="Resumo" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label="Domínios novos hoje" value={fmtCount(data.kpis.newToday)} />
        <KpiTile label="Passaram no corte" value={fmtCount(data.kpis.passedCut)} emphasis />
        <KpiTile label="Criativo em 2+ páginas" value={fmtCount(data.kpis.repeatedCreative)} hint="Blindagem: o sinal mais forte" />
        <KpiTile label="Anúncios lidos" value={fmtCount(data.kpis.adsRead)} hint="Na última varredura" />
      </section>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="overflow-x-auto">
          <TabsList className="h-auto">
            {TAB_ORDER.map((status) => (
              <TabsTrigger key={status} value={status} className="min-h-11 gap-1.5 px-4">
                {STATUS_LABELS[status]}
                <span className="tabular-nums text-text-muted">{byStatus.get(status)?.length ?? 0}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {TAB_ORDER.map((status) => {
          const list = byStatus.get(status) ?? [];
          return (
            <TabsContent key={status} value={status} className="motion-reduce:animate-none">
              {list.length === 0 ? (
                <EmptyTab status={status} hasData={data.offers.length > 0} />
              ) : (
                <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                  {list.map((offer) => (
                    <OfferCard key={offer.id} offer={offer} />
                  ))}
                </ul>
              )}
            </TabsContent>
          );
        })}
      </Tabs>

      <CutsDialog open={cutsOpen} onClose={() => setCutsOpen(false)} cut={data.cut} />
    </div>
  );
}

function EmptyTab({ status, hasData }: { status: OfferStatus; hasData: boolean }) {
  const text: Record<OfferStatus, string> = {
    novo: hasData ? "Nenhum domínio novo esperando triagem." : "Rode uma varredura para encher o funil com domínios.",
    em_analise: "Nada em análise agora.",
    aprovado: "Nenhuma oferta aprovada. Aprovar liga a revisita diária do scraper próprio.",
    descartado: "Nada descartado.",
  };
  return <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-text-secondary">{text[status]}</p>;
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dd className="font-display text-xl font-bold tabular-nums text-foreground">{value}</dd>
      <dt className="truncate text-[11px] text-text-muted">{label}</dt>
    </div>
  );
}

function OfferCard({ offer }: { offer: OfferCardView }) {
  const s = offer.signals;
  return (
    <li className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/garimpo/${encodeURIComponent(offer.domain)}`}
            className="block truncate font-display text-lg font-semibold text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {offer.domain}
          </Link>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {offer.divergent && (
              <Chip tone="warning">
                <AlertTriangle size={11} aria-hidden="true" /> Domínio divergente
              </Chip>
            )}
            {offer.passesCut && <Chip tone="primary">Passou no corte</Chip>}
            {s && s.repeatedCreatives > 0 && (
              <Chip tone="primary" title={offer.weakHash ? "Comparação por texto/arquivo: sinal mais fraco que por imagem" : undefined}>
                <Layers size={11} aria-hidden="true" /> Criativo em {s.maxPagesPerCreative} páginas{offer.weakHash ? " · por texto" : ""}
              </Chip>
            )}
            {offer.watch && (
              <Chip tone="muted">
                <Eye size={11} aria-hidden="true" /> Vigiada
              </Chip>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-2xl font-bold tabular-nums text-primary">{fmtScore(offer.score)}</div>
          <div className="text-[11px] text-text-muted">score de sinal</div>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Signal label="páginas" value={fmtCount(s?.pageCount)} />
        <Signal label="anúncios ativos" value={fmtCount(s?.activeAds)} />
        <Signal label="mais antigo no ar" value={fmtDays(s?.oldestActiveDays)} />
        <Signal label="novos em 14 dias" value={fmtCount(s?.new14d)} />
      </dl>

      <div className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 gap-1.5">
          {offer.thumbs.length === 0 ? (
            <span className="text-xs text-text-muted">Sem miniaturas</span>
          ) : (
            offer.thumbs.map((src) => <Thumb key={src} src={src} className="h-12 w-12 shrink-0 rounded-md border border-border" />)
          )}
        </div>
        <Sparkline values={offer.spark} label="Anúncios ativos por dia" />
      </div>

      <OfferActions offerId={offer.id} domain={offer.domain} status={offer.status} divergent={offer.divergent} />
    </li>
  );
}

function Chip({ tone, title, children }: { tone: "warning" | "primary" | "muted"; title?: string; children: React.ReactNode }) {
  const tones = {
    warning: "border-warning/25 bg-warning-dim text-warning",
    primary: "border-primary/25 bg-primary-dim text-primary",
    muted: "border-border bg-surface-2 text-text-secondary",
  };
  return (
    <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>
      {children}
    </span>
  );
}

function CutsDialog({ open, onClose, cut }: { open: boolean; onClose: () => void; cut: Cut }) {
  const [minAds, setMinAds] = useState(String(cut.minAds));
  const [minDays, setMinDays] = useState(String(cut.minDays));
  const [minPages, setMinPages] = useState(String(cut.minPages));
  const [formats, setFormats] = useState<string[]>(cut.formats);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const toggle = (value: string) => setFormats((prev) => (prev.includes(value) ? prev.filter((f) => f !== value) : [...prev, value]));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await saveCuts({
        minAds: Number(minAds),
        minDays: Number(minDays),
        minPages: Number(minPages),
        formats: formats as Array<"image" | "video" | "carousel">,
      });
      if (result.ok) onClose();
      else setError(result.error);
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Cortes" description="Uma oferta passa no corte quando atinge todos os mínimos abaixo.">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <NumberField label="Anúncios ativos" value={minAds} onChange={setMinAds} />
          <NumberField label="Dias no ar" value={minDays} onChange={setMinDays} />
          <NumberField label="Páginas" value={minPages} onChange={setMinPages} />
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">Formatos (vazio = todos)</legend>
          <div className="flex flex-wrap gap-2">
            {FORMAT_OPTIONS.map((f) => (
              <label
                key={f.value}
                className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm transition-colors motion-reduce:transition-none ${
                  formats.includes(f.value) ? "border-primary/40 bg-primary-dim text-primary" : "border-border bg-input text-text-secondary"
                }`}
              >
                <input type="checkbox" checked={formats.includes(f.value)} onChange={() => toggle(f.value)} className="h-4 w-4 accent-[#44d5a4]" />
                {f.label}
              </label>
            ))}
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="h-11 rounded-lg border border-border bg-surface-2 px-4 text-sm font-semibold text-text-primary hover:bg-input">
            Cancelar
          </button>
          <button type="submit" disabled={pending} className="h-11 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-bright disabled:opacity-50">
            Salvar cortes
          </button>
        </div>
      </form>
    </Modal>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-xs text-text-secondary">{label}</span>
      <input type="number" inputMode="numeric" min={0} value={value} onChange={(e) => onChange(e.target.value)} className={`${fieldClass} tabular-nums`} />
    </label>
  );
}
