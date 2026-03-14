import Link from "next/link";
import { redirect } from "next/navigation";
import { getDashboardData } from "@/lib/dashboard/queries";


export const metadata = {
  title: "Performance | Start Metric",
  description: "Analise campanhas Meta Ads com gasto, receita, ROAS e CPA.",
};

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

type SearchParams = Record<string, string | string[] | undefined>;

function getParam(searchParams: SearchParams, key: string): string | undefined {
  const value = searchParams[key];
  if (typeof value === "string") return value;
  return undefined;
}

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const filters = {
    from: getParam(searchParams, "from"),
    to: getParam(searchParams, "to"),
    adAccountId: getParam(searchParams, "adAccountId"),
    campaignStatus: getParam(searchParams, "campaignStatus"),
  };

  let data: Awaited<ReturnType<typeof getDashboardData>>;
  try {
    data = await getDashboardData(filters);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "UNAUTHORIZED") redirect("/auth");

    return (
      <main className="flex-1 p-4 lg:p-8 overflow-y-auto min-w-0">
        <h1 className="text-2xl font-bold mt-6 text-white">Performance</h1>
        <p className="text-slate-400 mt-2">Falha ao carregar dados: {message}</p>
      </main>
    );
  }

  const hasData = data.campaigns.length > 0;

  return (
    <main className="flex-1 p-4 lg:p-8 overflow-y-auto min-w-0">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[11px] text-cyan-400/70 uppercase tracking-[0.2em] font-semibold">
                Meta Ads
              </p>
              <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none">
                Performance de Campanhas
              </h1>
              <p className="text-xs text-slate-500">
                {data.range.from} → {data.range.to} · TZ: {data.timezone}
              </p>
            </div>
            <Link
              href="/settings/meta"
              className="px-4 py-2.5 rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-sm font-semibold hover:bg-cyan-400/20 transition-all duration-200"
            >
              Conectar / Gerenciar Meta
            </Link>
          </div>

          {/* Filters */}
          <form
            action="/performance"
            method="get"
            className="glass rounded-2xl p-5 grid grid-cols-1 md:grid-cols-4 gap-4"
          >
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Conta</label>
              <select
                name="adAccountId"
                defaultValue={data.filters.adAccountId}
                className="w-full glass rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
              >
                <option value="all">Todas</option>
                {data.filterOptions.accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500">Status</label>
              <select
                name="campaignStatus"
                defaultValue={data.filters.campaignStatus === "all" ? "all" : data.filters.campaignStatus}
                className="w-full glass rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
              >
                <option value="all">Todos</option>
                {data.filterOptions.statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500">De</label>
              <input
                name="from"
                type="date"
                defaultValue={data.range.from}
                className="w-full glass rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500">Até</label>
              <input
                name="to"
                type="date"
                defaultValue={data.range.to}
                className="w-full glass rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
              />
            </div>

            <div className="md:col-span-4 flex items-center justify-end gap-3">
              <Link
                href="/performance"
                className="text-sm text-slate-500 hover:text-slate-200 transition-colors"
              >
                Limpar
              </Link>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 text-sm font-semibold hover:bg-cyan-400/20 transition-all duration-200"
              >
                Aplicar filtros
              </button>
            </div>
          </form>

          {/* No data state */}
          {!hasData ? (
            <div className="glass rounded-2xl p-8">
              <h2 className="text-lg font-semibold text-white">Sem dados ainda</h2>
              <p className="text-slate-400 mt-2 text-sm">
                Conecte uma conta Meta e clique em &quot;Sincronizar&quot; em{" "}
                <Link href="/settings/meta" className="text-cyan-400 hover:text-cyan-300">
                  Integrações → Meta Ads
                </Link>
                . Depois volte aqui para ver campanhas e métricas.
              </p>
            </div>
          ) : (
            <>
              {/* KPI grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard title="Gasto" value={formatCurrencyBRL(data.kpis.adSpend)} />
                <KpiCard title="Receita atribuída" value={formatCurrencyBRL(data.kpis.revenueAttributed)} />
                <KpiCard title="ROAS" value={formatRatio(data.kpis.roas)} />
                <KpiCard title="CPA" value={formatCurrencyBRL(data.kpis.cpa)} />
                <KpiCard title="Conversões" value={formatNumber(data.kpis.attributedConversions)} />
                <KpiCard title="Impressões" value={formatNumber(data.kpis.impressions)} />
                <KpiCard title="Cliques" value={formatNumber(data.kpis.clicks)} />
                <KpiCard title="Campanhas" value={formatNumber(data.campaigns.length)} />
              </div>

              {/* Campaign table */}
              <div className="glass rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-800/60 flex items-center justify-between">
                  <h2 className="font-semibold text-white">Campanhas</h2>
                  <p className="text-xs text-slate-500">
                    Gerado em {new Date(data.generatedAt).toLocaleString("pt-BR")}
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
                      {data.campaigns.map((row) => (
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
            </>
          )}
        </div>
    </main>
  );
}

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="glass rounded-2xl p-5">
      <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">{title}</p>
      <p className="text-xl font-bold mt-2 text-white text-mono">{value}</p>
    </div>
  );
}
