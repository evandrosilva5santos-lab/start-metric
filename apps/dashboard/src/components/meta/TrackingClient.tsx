"use client";

import { useState } from "react";
import {
  Target,
  Copy,
  Check,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Link2,
  Sparkles,
  ExternalLink,
  Flame,
  HelpCircle,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { useDashboardFilters } from "@/store/dashboard-filters";
import { formatMoney } from "@/lib/format";
import { MetaDataGate, PageHeading, SectionCard, KpiTile } from "@/components/meta/MetaUi";
import type { DadosResponse, TrackingAdItem } from "@/lib/meta/dados-types";

export function TrackingClient() {
  return (
    <div className="space-y-6">
      <PageHeading
        title="Rastreamento & Retargeting"
        subtitle="Auditoria de UTMs dos anúncios, gerador de checkout e inteligência de remarketing"
      />
      <MetaDataGate>{(data) => <TrackingHub data={data} />}</MetaDataGate>
    </div>
  );
}

const DEFAULT_TRACKING_STRING =
  "utm_source=meta&utm_medium={{adset.name}}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}&src=meta-{{adset.name}}-{{campaign.name}}&sck=meta-{{adset.name}}-{{campaign.name}}";

function TrackingHub({ data }: { data: DadosResponse }) {
  const hide = useDashboardFilters((s) => s.hideValues);
  const currency = data.conta.currency || "BRL";
  const tracking = data.tracking;

  // Estado do Gerador
  const [destinationUrl, setDestinationUrl] = useState("");
  const [checkoutPreset, setCheckoutPreset] = useState("universal");
  const [copiedMeta, setCopiedMeta] = useState(false);
  const [copiedFull, setCopiedFull] = useState(false);

  // Filtros da tabela
  const [filterTab, setFilterTab] = useState<"all" | "untracked" | "tracked" | "retargeting">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const trackingString = DEFAULT_TRACKING_STRING;

  const getFullUrl = () => {
    if (!destinationUrl.trim()) return "";
    const cleanUrl = destinationUrl.trim();
    const separator = cleanUrl.includes("?") ? "&" : "?";
    return `${cleanUrl}${separator}${trackingString}`;
  };

  const handleCopyMeta = async () => {
    try {
      await navigator.clipboard.writeText(trackingString);
      setCopiedMeta(true);
      setTimeout(() => setCopiedMeta(false), 2500);
    } catch {
      // fallback
    }
  };

  const handleCopyFull = async () => {
    const full = getFullUrl();
    if (!full) return;
    try {
      await navigator.clipboard.writeText(full);
      setCopiedFull(true);
      setTimeout(() => setCopiedFull(false), 2500);
    } catch {
      // fallback
    }
  };

  const allAds = tracking?.ads || [];

  const filteredAds = allAds.filter((ad) => {
    if (filterTab === "untracked" && ad.hasTracking) return false;
    if (filterTab === "tracked" && !ad.hasTracking) return false;
    if (filterTab === "retargeting" && !ad.isRetargeting) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = ad.name.toLowerCase().includes(q);
      const matchCamp = ad.campaignName.toLowerCase().includes(q);
      const matchAdset = ad.adsetName.toLowerCase().includes(q);
      if (!matchName && !matchCamp && !matchAdset) return false;
    }
    return true;
  });

  const totalAds = tracking?.totalAds || 0;
  const untrackedAds = tracking?.untrackedAds || 0;
  const untrackedSpend = tracking?.untrackedSpend || 0;
  const trackedPercentage = tracking?.trackedPercentage ?? 100;
  const retargetingCount = tracking?.retargetingCampaignsCount || 0;
  const retargetingSpend = tracking?.retargetingSpend || 0;

  return (
    <div className="space-y-6">
      {/* Alerta Crítico se houver dinheiro no escuro */}
      {untrackedSpend > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-danger/30 bg-danger-dim/30 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 shrink-0 text-danger" size={20} />
            <div>
              <p className="text-sm font-semibold text-danger">
                {formatMoney(untrackedSpend, currency, hide)} investidos sem parâmetros de rastreamento
              </p>
              <p className="text-xs text-text-secondary">
                {untrackedAds} anúncios desta conta estão com o campo de URL vazio. Seus checkouts não conseguem
                identificar de qual anúncio ou conjunto as vendas vieram.
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilterTab("untracked")}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-danger/40 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger/20"
          >
            Ver Anúncios sem Rastreio
          </button>
        </div>
      )}

      {/* Grid de KPIs Superiores */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile
          label="Taxa de Rastreamento"
          value={`${trackedPercentage.toFixed(0)}%`}
          hint={`${tracking?.trackedAds || 0} de ${totalAds} anúncios com UTM`}
          emphasis={trackedPercentage > 80}
        />
        <KpiTile
          label="Verba no Escuro"
          value={formatMoney(untrackedSpend, currency, hide)}
          hint={`${untrackedAds} anúncios sem parâmetros`}
          emphasis={untrackedSpend === 0}
        />
        <KpiTile
          label="Retargeting Ativo"
          value={formatMoney(retargetingSpend, currency, hide)}
          hint={`${retargetingCount} campanhas de remarketing`}
        />
        <KpiTile
          label="Total de Anúncios"
          value={String(totalAds)}
          hint="Catalogados nesta conta"
        />
      </div>

      {/* BLOCO 1: Gerador de Parâmetros de URL */}
      <SectionCard
        title="Gerador de Parâmetros de URL & Checkout"
        subtitle="Carimbo padronizado com macros automáticas da Meta e suporte a SRC/SCK"
        action={
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary-dim px-2.5 py-1 text-xs font-semibold text-primary">
            <Sparkles size={13} /> Macros Dinâmicas
          </span>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                URL da Página de Vendas ou Checkout (Opcional)
              </label>
              <div className="mt-1.5 flex items-center rounded-lg border border-border bg-input px-3 focus-within:border-primary">
                <Link2 size={16} className="text-text-muted" />
                <input
                  type="text"
                  placeholder="https://seusite.com.br/checkout ou https://pay.kiwify.com.br/..."
                  value={destinationUrl}
                  onChange={(e) => setDestinationUrl(e.target.value)}
                  className="w-full bg-transparent px-2.5 py-2.5 text-sm text-foreground placeholder:text-text-muted focus:outline-none"
                />
                {destinationUrl && (
                  <button
                    onClick={() => setDestinationUrl("")}
                    className="text-xs text-text-muted hover:text-foreground"
                  >
                    Limpar
                  </button>
                )}
              </div>
              <p className="mt-1 text-[11px] text-text-muted">
                Dica: Você pode colar apenas o carimbo direto na Meta ou copiar a URL completa pronta para anúncios de link direto.
              </p>
            </div>

            <div className="lg:col-span-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Plataforma de Checkout
              </label>
              <select
                value={checkoutPreset}
                onChange={(e) => setCheckoutPreset(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                <option value="universal">Hotmart / Kiwify / Eduzz / Greenn / Braip</option>
                <option value="shopify">Shopify / Yampi / CartPanda / Nuvemshop</option>
                <option value="lead">Página de Captura / Formulário de Leads</option>
              </select>
              <p className="mt-1 text-[11px] text-text-muted">
                Preenche `src` e `sck` no formato <code className="text-primary">origem-meio-campanha</code>.
              </p>
            </div>
          </div>

          {/* Caixa de Código dos Parâmetros para colar no Gerenciador */}
          <div className="rounded-xl border border-border bg-surface-2 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
                  Texto para o campo &quot;Parâmetros de URL&quot; do Gerenciador de Anúncios
                </span>
                <p className="text-[11px] text-text-secondary">
                  Cole exatamente este texto no nível do anúncio. Não use `?` no início.
                </p>
              </div>
              <button
                onClick={handleCopyMeta}
                className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
                  copiedMeta
                    ? "bg-emerald-600 text-white"
                    : "bg-primary text-primary-foreground hover:bg-primary-bright"
                }`}
              >
                {copiedMeta ? <Check size={14} /> : <Copy size={14} />}
                {copiedMeta ? "Copiado com Sucesso!" : "Copiar Parâmetros da Meta"}
              </button>
            </div>

            <div className="mt-3 overflow-x-auto rounded-lg border border-border/80 bg-background/90 p-3 font-mono text-xs leading-relaxed text-primary">
              {trackingString}
            </div>

            {destinationUrl.trim() && (
              <div className="mt-4 border-t border-border pt-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs font-bold text-text-secondary">
                    URL Completa de Destino com o Carimbo:
                  </span>
                  <button
                    onClick={handleCopyFull}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    {copiedFull ? <Check size={13} /> : <Copy size={13} />}
                    {copiedFull ? "Copiado!" : "Copiar URL Completa"}
                  </button>
                </div>
                <div className="mt-1.5 truncate rounded border border-border/50 bg-background/50 p-2 font-mono text-[11px] text-text-muted">
                  {getFullUrl()}
                </div>
              </div>
            )}
          </div>

          {/* Guia Rápido de Aplicação */}
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-border/60 bg-card/60 p-4 sm:grid-cols-3">
            <div className="space-y-1">
              <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
                  1
                </span>
                Edição em Massa
              </span>
              <p className="text-[11px] leading-relaxed text-text-secondary">
                No Gerenciador de Anúncios, selecione todos os anúncios ativos e clique no botão <strong>Editar (Ctrl+E)</strong>.
              </p>
            </div>

            <div className="space-y-1">
              <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
                  2
                </span>
                Campo Rastreamento
              </span>
              <p className="text-[11px] leading-relaxed text-text-secondary">
                Role até a seção <strong>Rastreamento</strong> e cole no campo <strong>Parâmetros de URL</strong> (sem interrogação).
              </p>
            </div>

            <div className="space-y-1">
              <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 text-[11px] font-bold text-primary">
                  3
                </span>
                Identificação na Venda
              </span>
              <p className="text-[11px] leading-relaxed text-text-secondary">
                Na primeira venda na Kiwify, Hotmart ou Eduzz, a coluna <strong>SRC</strong> mostrará o conjunto e a campanha exatos.
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* BLOCO 2: Auditoria de Anúncios da Conta */}
      <SectionCard
        title="Auditoria de Anúncios da Conta"
        subtitle={`${filteredAds.length} anúncios filtrados`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-border bg-input p-0.5 text-xs font-medium">
              <button
                onClick={() => setFilterTab("all")}
                className={`rounded px-2.5 py-1 transition-colors ${
                  filterTab === "all" ? "bg-surface-2 text-foreground font-semibold" : "text-text-secondary"
                }`}
              >
                Todos ({allAds.length})
              </button>
              <button
                onClick={() => setFilterTab("untracked")}
                className={`flex items-center gap-1 rounded px-2.5 py-1 transition-colors ${
                  filterTab === "untracked" ? "bg-danger-dim text-danger font-semibold" : "text-danger"
                }`}
              >
                Sem Rastreio ({untrackedAds})
              </button>
              <button
                onClick={() => setFilterTab("tracked")}
                className={`rounded px-2.5 py-1 transition-colors ${
                  filterTab === "tracked" ? "bg-surface-2 text-primary font-semibold" : "text-text-secondary"
                }`}
              >
                Com Rastreio ({totalAds - untrackedAds})
              </button>
              <button
                onClick={() => setFilterTab("retargeting")}
                className={`flex items-center gap-1 rounded px-2.5 py-1 transition-colors ${
                  filterTab === "retargeting" ? "bg-primary-dim text-primary font-semibold" : "text-text-secondary"
                }`}
              >
                <Flame size={12} /> Remarketing
              </button>
            </div>
            <input
              type="text"
              placeholder="Buscar anúncio..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="rounded-lg border border-border bg-input px-3 py-1 text-xs text-foreground placeholder:text-text-muted focus:border-primary focus:outline-none"
            />
          </div>
        }
      >
        {filteredAds.length === 0 ? (
          <div className="py-12 text-center">
            <ShieldCheck className="mx-auto text-primary" size={32} />
            <p className="mt-2 text-sm font-semibold text-foreground">Nenhum anúncio encontrado neste filtro</p>
            <p className="text-xs text-text-secondary">Altere os filtros acima para visualizar outros criativos.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                  <th className="py-3 pr-4">Anúncio</th>
                  <th className="py-3 px-3">Campanha / Conjunto</th>
                  <th className="py-3 px-3">Gasto</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Rastreio (url_tags)</th>
                  <th className="py-3 pl-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredAds.map((ad) => (
                  <tr key={ad.id} className="hover:bg-surface-2/40 transition-colors">
                    <td className="py-3 pr-4 font-medium text-foreground">
                      <div className="flex items-center gap-2.5">
                        {ad.thumbnailUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={ad.thumbnailUrl}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded object-cover border border-border"
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-border bg-surface-2 text-text-muted text-[10px]">
                            AD
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground max-w-[220px]" title={ad.name}>
                            {ad.name}
                          </p>
                          <span className="text-[10px] text-text-muted font-mono">{ad.id}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-text-secondary">
                      <p className="truncate font-medium text-foreground max-w-[180px]" title={ad.campaignName}>
                        {ad.campaignName || "—"}
                      </p>
                      <p className="truncate text-[11px] text-text-muted max-w-[180px]" title={ad.adsetName}>
                        {ad.adsetName || "—"}
                      </p>
                    </td>

                    <td className="py-3 px-3 font-mono font-semibold tabular-nums text-foreground">
                      {formatMoney(ad.spend, currency, hide)}
                    </td>

                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          ad.effectiveStatus === "ACTIVE"
                            ? "border border-primary/20 bg-primary-dim text-primary"
                            : "border border-border bg-surface-2 text-text-muted"
                        }`}
                      >
                        {ad.effectiveStatus === "ACTIVE" ? "Ativo" : "Pausado"}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      {ad.hasTracking ? (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary-dim px-2 py-0.5 text-[10px] font-semibold text-primary">
                            <CheckCircle2 size={11} /> Rastreado
                          </span>
                          <span
                            className="max-w-[160px] truncate font-mono text-[10px] text-text-muted"
                            title={ad.urlTags}
                          >
                            {ad.urlTags}
                          </span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-danger/30 bg-danger-dim px-2 py-0.5 text-[10px] font-semibold text-danger">
                          <AlertTriangle size={11} /> Sem Rastreio
                        </span>
                      )}
                    </td>

                    <td className="py-3 pl-3 text-right">
                      <button
                        onClick={handleCopyMeta}
                        className="inline-flex items-center gap-1 rounded border border-border bg-input px-2 py-1 text-[11px] font-semibold text-text-primary hover:border-primary hover:text-primary transition-colors"
                        title="Copiar carimbo da Meta para este anúncio"
                      >
                        <Copy size={11} /> Carimbo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
