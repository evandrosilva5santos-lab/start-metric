"use client";

import { cn, statusLabel } from "@/lib/utils";
import type { DashboardCampaignRow } from "@/lib/dashboard/types";

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

type CampaignsTableProps = {
  campaigns: DashboardCampaignRow[];
};

export function CampaignsTable({ campaigns }: CampaignsTableProps) {
  return (
    <section className="glass rounded-3xl p-6 lg:p-8 min-h-[500px] relative overflow-hidden group border-white/10">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-cyan-500/[0.02] rounded-full blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />

      <div className="flex items-center justify-between mb-6 lg:mb-8 relative z-10">
        <div>
          <h2 className="text-lg font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
            <span className="w-2 h-6 bg-cyan-500 rounded-sm shadow-[0_0_15px_rgba(6,189,212,0.5)]" />
            Operações de Combate
          </h2>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
            {"// Desempenho granular por campanha ativa"}
          </p>
        </div>
        <div className="flex items-center gap-2 glass px-4 py-2 rounded-xl border-white/5">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
          <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
            {campaigns.length} Ativas
          </span>
        </div>
      </div>

      <div className="overflow-x-auto relative z-10">
        <table className="w-full text-left border-separate border-spacing-y-3">
          <caption className="sr-only">Desempenho por campanha</caption>
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-black">
              <th scope="col" className="px-6 pb-2">Campanha</th>
              <th scope="col" className="px-6 pb-2">Conta</th>
              <th scope="col" className="px-6 pb-2 text-right">Gasto</th>
              <th scope="col" className="px-6 pb-2 text-right">Receita</th>
              <th scope="col" className="px-6 pb-2 text-right">ROAS</th>
              <th scope="col" className="px-6 pb-2 text-right">Lucro</th>
              <th scope="col" className="px-6 pb-2 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-20 text-center">
                  <p className="text-xs font-black uppercase tracking-widest text-slate-700">
                    {"// Sistema aguardando dados operacionais"}
                  </p>
                </td>
              </tr>
            ) : (
              campaigns.map((campaign) => (
                <tr key={campaign.campaignId} className="group/row transition-all duration-300">
                  <td className="px-6 py-5 rounded-l-2xl border-white/5 border-y border-l bg-white/[0.02] group-hover/row:bg-white/[0.06] group-hover/row:border-cyan-500/30 transition-all">
                    <div>
                      <p className="text-xs font-black text-white uppercase tracking-wider group-hover/row:text-cyan-400 transition-colors">
                        {campaign.campaignName}
                      </p>
                      <p className="text-[9px] font-bold text-slate-500 mt-1 uppercase tracking-widest">
                        {campaign.campaignId.substring(0, 12)}...
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-5 border-white/5 border-y bg-white/[0.02] group-hover/row:bg-white/[0.06] group-hover/row:border-cyan-500/30 transition-all">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                      {campaign.accountName}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right border-white/5 border-y bg-white/[0.02] group-hover/row:bg-white/[0.06] group-hover/row:border-cyan-500/30 transition-all">
                    <span className="text-xs font-black text-white text-mono">
                      {formatCurrency(campaign.spend)}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right border-white/5 border-y bg-white/[0.02] group-hover/row:bg-white/[0.06] group-hover/row:border-cyan-500/30 transition-all">
                    <span className="text-xs font-black text-slate-300 text-mono">
                      {formatCurrency(campaign.revenue)}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right border-white/5 border-y bg-white/[0.02] group-hover/row:bg-white/[0.06] group-hover/row:border-cyan-500/30 transition-all">
                    <div className="flex flex-col items-end">
                      <span
                        className={cn(
                          "text-sm font-black text-mono",
                          campaign.roas >= 2
                            ? "text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)]"
                            : campaign.roas >= 1.2
                              ? "text-cyan-400"
                              : "text-amber-400",
                        )}
                      >
                        {campaign.roas.toFixed(2)}x
                      </span>
                      <div className="w-12 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 shadow-[0_0_5px_#06b6d4]"
                          style={{ width: `${Math.min(campaign.roas * 20, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right border-white/5 border-y bg-white/[0.02] group-hover/row:bg-white/[0.06] group-hover/row:border-cyan-500/30 transition-all">
                    <span
                      className={cn(
                        "text-xs font-black text-mono",
                        campaign.grossProfit >= 0 ? "text-emerald-400" : "text-red-400",
                      )}
                    >
                      {formatCurrency(campaign.grossProfit)}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-right rounded-r-2xl border-white/5 border-y border-r bg-white/[0.02] group-hover/row:bg-white/[0.06] group-hover/row:border-cyan-500/30 transition-all">
                    <span
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest",
                        campaign.status === "ACTIVE"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-slate-700/30 text-slate-500 border border-slate-700/50",
                      )}
                    >
                      {statusLabel(campaign.status)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
