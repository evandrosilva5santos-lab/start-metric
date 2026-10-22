"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SectionCard } from "@/components/meta/MetaUi";
import { useMounted } from "@/hooks/useMounted";
import { AXIS_COLOR, CHART_SERIES, GRID_COLOR, TOOLTIP_CONTENT_STYLE, TOOLTIP_LABEL_STYLE } from "@/lib/chart-theme";
import { formatDecimal, formatInteger, formatMoney, formatRate, formatRatio } from "@/lib/format";
import type { ChannelOverview as Overview, ChannelSummary } from "@/lib/dashboard/channels";

type Response = Overview & { client: { id: string; name: string } | null; from: string; to: string; accounts: { meta: number; google: number } };

type Row = { label: string; format: (s: ChannelSummary) => string };

const show = (value: number | null, format: (v: number) => string) => (value === null ? "—" : format(value));

const ROWS: Row[] = [
  { label: "Investimento", format: (s) => formatMoney(s.spend) },
  { label: "Impressões", format: (s) => formatInteger(s.impressions) },
  { label: "Cliques", format: (s) => formatInteger(s.clicks) },
  { label: "CTR", format: (s) => show(s.ctr, (v) => formatRate(v)) },
  { label: "CPC", format: (s) => show(s.cpc, (v) => formatMoney(v)) },
  { label: "CPM", format: (s) => show(s.cpm, (v) => formatMoney(v)) },
  { label: "Conversões", format: (s) => formatDecimal(s.conversions, s.conversions % 1 === 0 ? 0 : 1) },
  { label: "Receita / valor", format: (s) => formatMoney(s.value) },
  { label: "ROAS", format: (s) => show(s.roas, (v) => formatRatio(v)) },
];

const formatDay = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`;
const toBr = (day: string) => day.split("-").reverse().join("/");

export function ChannelOverview({ clientId, from, to }: { clientId: string; from: string; to: string }) {
  const mounted = useMounted();
  const query = useQuery({
    queryKey: ["overview", "channels", clientId, from, to],
    queryFn: async (): Promise<Response> => {
      const params = new URLSearchParams({ clientId, from, to });
      const res = await fetch(`/api/overview/channels?${params}`, { cache: "no-store" });
      const json = (await res.json().catch(() => ({}))) as Response & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`);
      return json;
    },
  });

  if (query.isPending) return <div className="h-80 animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none" aria-busy="true" />;
  if (query.isError) {
    return (
      <div role="alert" className="rounded-lg border border-danger/30 bg-danger-tint p-4 text-sm text-danger">
        {query.error.message}
      </div>
    );
  }

  const data = query.data;
  const noAccounts = data.accounts.meta + data.accounts.google === 0;

  return (
    <div className="space-y-6">
      <p className="text-xs tabular-nums text-text-secondary">
        {data.client?.name ?? "Cliente"} · De {toBr(data.from)} a {toBr(data.to)} · {data.accounts.meta} conta(s) Meta e{" "}
        {data.accounts.google} conta(s) Google
      </p>

      {noAccounts ? (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-text-secondary">
          Este cliente ainda não tem contas ligadas. Ligue as contas na{" "}
          <Link href={`/clients/${clientId}`} className="font-semibold text-primary hover:underline">
            página do cliente
          </Link>
          .
        </div>
      ) : (
        <>
          <SectionCard title="Meta × Google" subtitle="Cada canal com os próprios números; o total recalcula as taxas sobre a soma">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm tabular-nums">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-fg-muted">
                    <th className="py-2 pr-3 font-semibold">Métrica</th>
                    <th className="py-2 pr-3 text-right font-semibold">Meta Ads</th>
                    <th className="py-2 pr-3 text-right font-semibold">Google Ads</th>
                    <th className="py-2 text-right font-semibold text-fg">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row.label} className="border-b border-border last:border-0">
                      <td className="py-2.5 pr-3 text-text-secondary">{row.label}</td>
                      <td className="py-2.5 pr-3 text-right">{data.hasMeta ? row.format(data.meta) : "—"}</td>
                      <td className="py-2.5 pr-3 text-right">{data.hasGoogle ? row.format(data.google) : "—"}</td>
                      <td className="py-2.5 text-right font-semibold text-fg">{row.format(data.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!data.hasMeta && data.accounts.meta > 0 && (
              <p className="mt-3 text-xs text-fg-muted">As contas Meta deste cliente não tiveram gasto no período.</p>
            )}
            {!data.hasGoogle && data.accounts.google > 0 && (
              <p className="mt-3 text-xs text-fg-muted">As contas Google deste cliente não tiveram gasto no período.</p>
            )}
          </SectionCard>

          <SectionCard title="Investimento por dia" subtitle="Meta e Google empilhados">
            <div className="h-64">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid stroke={GRID_COLOR} strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" tickFormatter={formatDay} stroke={AXIS_COLOR} fontSize={12} tickLine={false} />
                    <YAxis stroke={AXIS_COLOR} fontSize={12} tickLine={false} width={72} tickFormatter={(v: number) => formatMoney(v)} />
                    <Tooltip
                      contentStyle={TOOLTIP_CONTENT_STYLE}
                      labelStyle={TOOLTIP_LABEL_STYLE}
                      labelFormatter={(d) => formatDay(String(d))}
                      formatter={(value) => formatMoney(Number(value))}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="meta" name="Meta Ads" stackId="spend" fill={CHART_SERIES[0]} />
                    <Bar dataKey="google" name="Google Ads" stackId="spend" fill={CHART_SERIES[1]} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}
