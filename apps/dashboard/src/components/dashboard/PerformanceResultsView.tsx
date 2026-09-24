import type { DashboardCampaignRow, DashboardKpis } from "@/lib/dashboard/types";

function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(value);
}

function formatRatio(value: number): string {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value)}x`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

type PerformanceResultsViewProps = {
  kpis: DashboardKpis;
  campaigns: DashboardCampaignRow[];
  generatedAt: string;
  /** true quando os números vêm da cópia local e os novos ainda estão chegando. */
  stale?: boolean;
};

/**
 * Faixa de KPIs + tabela de campanhas. Sem estado: renderiza tanto os dados
 * do servidor quanto a cópia local mostrada enquanto eles chegam.
 */
export function PerformanceResultsView({ kpis, campaigns, generatedAt, stale = false }: PerformanceResultsViewProps) {
  return (
    <div className="space-y-8" aria-busy={stale || undefined}>
      {stale ? (
        <p className="inline-flex items-center gap-2 rounded-full border border-warning/30 bg-warning-dim px-3 py-1 text-xs font-semibold text-warning">
          <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse motion-reduce:animate-none" aria-hidden="true" />
          Últimos números, das {formatTime(generatedAt)} · atualizando…
        </p>
      ) : (
        <p role="status" className="sr-only">
          Números atualizados às {formatTime(generatedAt)}.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Gasto" value={formatCurrencyBRL(kpis.adSpend)} />
        <KpiCard title="Receita atribuída" value={formatCurrencyBRL(kpis.revenueAttributed)} />
        <KpiCard title="ROAS" value={formatRatio(kpis.roas)} />
        <KpiCard title="CPA" value={formatCurrencyBRL(kpis.cpa)} />
        <KpiCard title="Conversões" value={formatNumber(kpis.attributedConversions)} />
        <KpiCard title="Impressões" value={formatNumber(kpis.impressions)} />
        <KpiCard title="Cliques" value={formatNumber(kpis.clicks)} />
        <KpiCard title="Campanhas" value={formatNumber(campaigns.length)} />
      </div>

      <div className="glass rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
          <h2 className="font-semibold text-white">Campanhas</h2>
          <p className="text-xs text-slate-500">
            Gerado em {new Date(generatedAt).toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-slate-600 border-b border-slate-800/60">
                <th className="text-left font-semibold px-5 py-3">Campanha</th>
                <th className="text-left font-semibold px-5 py-3">Conta</th>
                <th className="text-left font-semibold px-5 py-3">Status</th>
                <th className="text-right font-semibold px-5 py-3">Gasto</th>
                <th className="text-right font-semibold px-5 py-3">Receita</th>
                <th className="text-right font-semibold px-5 py-3">ROAS</th>
                <th className="text-right font-semibold px-5 py-3">CPA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/40">
              {campaigns.map((row) => (
                <tr key={row.campaignId} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3">
                    <div className="font-medium text-white">{row.campaignName}</div>
                    <div className="text-xs text-slate-600 font-mono">{row.campaignId}</div>
                  </td>
                  <td className="px-5 py-3 text-slate-300">{row.accountName}</td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-slate-700/50 text-slate-400 border border-slate-700/50">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right text-slate-300 text-mono tabular-nums">{formatCurrencyBRL(row.spend)}</td>
                  <td className="px-5 py-3 text-right text-slate-300 text-mono tabular-nums">{formatCurrencyBRL(row.revenue)}</td>
                  <td className="px-5 py-3 text-right text-emerald-400 font-bold text-mono tabular-nums">{formatRatio(row.roas)}</td>
                  <td className="px-5 py-3 text-right text-slate-300 text-mono tabular-nums">{formatCurrencyBRL(row.cpa)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{title}</p>
      <p className="text-xl font-bold mt-2 text-white text-mono tabular-nums">{value}</p>
    </div>
  );
}

/** Esqueleto no formato da faixa de KPIs e da tabela. */
export function PerformanceResultsSkeleton() {
  return (
    <div data-perf-fallback className="space-y-8" aria-busy="true" aria-label="Carregando números do período">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="glass rounded-2xl p-5 space-y-3" aria-hidden="true">
            <div className="h-3 w-20 rounded-full bg-white/5 animate-pulse" />
            <div className="h-6 w-28 rounded-lg bg-white/5 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="glass rounded-2xl h-[480px] animate-pulse" aria-hidden="true" />
    </div>
  );
}
