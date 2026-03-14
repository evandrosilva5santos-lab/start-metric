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
      <div className="min-h-screen bg-gray-950 text-white">
        <div className="max-w-6xl mx-auto px-6 py-12">
          <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Voltar
          </Link>
          <h1 className="text-2xl font-bold mt-6">Performance</h1>
          <p className="text-gray-400 mt-2">Falha ao carregar dados: {message}</p>
        </div>
      </div>
    );
  }

  const hasData = data.campaigns.length > 0;

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-xs text-gray-400">
              {data.range.from} → {data.range.to} · TZ: {data.timezone}
            </p>
            <h1 className="text-2xl font-bold">Performance (Meta Ads)</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/settings/meta"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 transition-colors text-sm font-semibold"
            >
              Conectar / Gerenciar Meta
            </Link>
            <Link
              href="/accounts"
              className="px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm font-semibold"
            >
              Contas
            </Link>
          </div>
        </div>

        <form
          action="/performance"
          method="get"
          className="bg-gray-900 border border-gray-800 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          <div className="space-y-1">
            <label className="text-xs text-gray-400">Conta</label>
            <select
              name="adAccountId"
              defaultValue={data.filters.adAccountId}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm"
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
            <label className="text-xs text-gray-400">Status</label>
            <select
              name="campaignStatus"
              defaultValue={data.filters.campaignStatus === "all" ? "all" : data.filters.campaignStatus}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm"
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
            <label className="text-xs text-gray-400">De</label>
            <input
              name="from"
              type="date"
              defaultValue={data.range.from}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-400">Ate</label>
            <input
              name="to"
              type="date"
              defaultValue={data.range.to}
              className="w-full bg-gray-950 border border-gray-800 rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <div className="md:col-span-4 flex items-center justify-end gap-3">
            <Link
              href="/performance"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Limpar
            </Link>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-white text-gray-950 hover:bg-white/90 transition-colors text-sm font-semibold"
            >
              Aplicar filtros
            </button>
          </div>
        </form>

        {!hasData ? (
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
            <h2 className="text-lg font-semibold">Sem dados ainda</h2>
            <p className="text-gray-400 mt-2 text-sm">
              Conecte uma conta Meta e clique em &quot;Sincronizar&quot; em{" "}
              <Link href="/settings/meta" className="text-blue-400 hover:text-blue-300">
                /settings/meta
              </Link>
              . Depois volte aqui para ver campanhas e metricas.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard title="Gasto" value={formatCurrencyBRL(data.kpis.adSpend)} />
              <KpiCard title="Receita (atribuida)" value={formatCurrencyBRL(data.kpis.revenueAttributed)} />
              <KpiCard title="ROAS" value={formatRatio(data.kpis.roas)} />
              <KpiCard title="CPA" value={formatCurrencyBRL(data.kpis.cpa)} />
              <KpiCard title="Conversoes" value={formatNumber(data.kpis.attributedConversions)} />
              <KpiCard title="Impressoes" value={formatNumber(data.kpis.impressions)} />
              <KpiCard title="Cliques" value={formatNumber(data.kpis.clicks)} />
              <KpiCard title="Campanhas" value={formatNumber(data.campaigns.length)} />
            </div>

            <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-800 flex items-center justify-between">
                <h2 className="font-semibold">Campanhas</h2>
                <p className="text-xs text-gray-500">Gerado em {new Date(data.generatedAt).toLocaleString("pt-BR")}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-950/40 text-gray-400">
                    <tr>
                      <th className="text-left font-medium px-5 py-3">Campanha</th>
                      <th className="text-left font-medium px-5 py-3">Conta</th>
                      <th className="text-left font-medium px-5 py-3">Status</th>
                      <th className="text-right font-medium px-5 py-3">Gasto</th>
                      <th className="text-right font-medium px-5 py-3">Receita</th>
                      <th className="text-right font-medium px-5 py-3">ROAS</th>
                      <th className="text-right font-medium px-5 py-3">CPA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.campaigns.map((row) => (
                      <tr key={row.campaignId} className="border-t border-gray-800">
                        <td className="px-5 py-3">
                          <div className="font-medium text-white">{row.campaignName}</div>
                          <div className="text-xs text-gray-500">{row.campaignId}</div>
                        </td>
                        <td className="px-5 py-3 text-gray-200">{row.accountName}</td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-800 text-gray-300 border border-gray-700">
                            {row.status}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right tabular-nums">{formatCurrencyBRL(row.spend)}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{formatCurrencyBRL(row.revenue)}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{formatRatio(row.roas)}</td>
                        <td className="px-5 py-3 text-right tabular-nums">{formatCurrencyBRL(row.cpa)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <p className="text-xs text-gray-400">{title}</p>
      <p className="text-xl font-bold mt-2">{value}</p>
    </div>
  );
}

