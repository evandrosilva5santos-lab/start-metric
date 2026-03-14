"use client";

import { cn, statusLabel } from "@/lib/utils";
import type { DashboardCampaignRow } from "@/lib/dashboard/types";
import { motion } from "framer-motion";

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
    <section className="glass glass-2 rounded-[2rem] p-6 lg:p-8 min-h-[500px] relative overflow-hidden group/table noise-overlay border-white/5">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-cyan-500/[0.04] rounded-full blur-[120px] transition-all duration-1000 group-hover/table:-translate-y-1/4 translate-x-1/4 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-indigo-500/[0.04] rounded-full blur-[100px] translate-y-1/4 -translate-x-1/4 pointer-events-none" />

      {/* Cybernetic Scan Line */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02]">
        <div className="w-full h-[150px] bg-gradient-to-b from-transparent via-cyan-400 to-transparent absolute top-0 animate-scan-slow" />
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 lg:mb-12 relative z-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="w-1.5 h-6 bg-cyan-500 rounded-full animate-pulse-fast shadow-[0_0_15px_rgba(6,189,212,0.8)]" />
            <h2 className="text-xl font-black text-white uppercase tracking-[0.25em]">
              Operações Estratégicas
            </h2>
          </div>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em] flex items-center gap-2">
            <span className="w-6 h-[1px] bg-slate-800" />
            Telemetria de Fluxo de Caixa
          </p>
        </div>
        
        <div className="flex items-center gap-3 glass px-5 py-3 rounded-2xl border-white/10 shadow-2xl backdrop-blur-xl shrink-0 group/stat hover:border-cyan-500/30 transition-colors">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-40"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500 shadow-[0_0_10px_#22d3ee]"></span>
          </div>
          <div className="flex flex-col">
            <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest leading-none">Status da Rede</span>
            <span className="text-[11px] font-black uppercase text-slate-200 tracking-widest mt-1">
              <span className="text-cyan-400 mr-1">{campaigns.length}</span> Vetores Ativos
            </span>
          </div>
        </div>
      </div>

      <div className="md:hidden relative z-10 space-y-3">
        {campaigns.length === 0 ? (
          <div className="rounded-3xl border border-white/[0.05] bg-white/[0.02] p-8 text-center">
            <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-600">
              Nenhuma campanha encontrada
            </p>
            <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-slate-700">
              Ajuste o periodo ou sincronize uma conta Meta para ver dados aqui.
            </p>
          </div>
        ) : (
          campaigns.map((campaign, idx) => (
            <motion.article
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.4 }}
              key={campaign.campaignId}
              className="rounded-3xl border border-white/[0.06] bg-white/[0.02] p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-100">
                    {campaign.campaignName}
                  </p>
                  <p className="mt-1 text-[9px] font-bold uppercase tracking-widest text-slate-600">
                    {campaign.accountName}
                  </p>
                </div>
                <span
                  className={cn(
                    "px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest border",
                    campaign.status === "ACTIVE"
                      ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                      : "bg-slate-800/40 text-slate-500 border-slate-700/60",
                  )}
                >
                  {statusLabel(campaign.status)}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-[10px]">
                <div>
                  <p className="text-slate-500 uppercase tracking-widest">Gasto</p>
                  <p className="mt-1 font-black text-slate-200">{formatCurrency(campaign.spend)}</p>
                </div>
                <div>
                  <p className="text-slate-500 uppercase tracking-widest">Receita</p>
                  <p className="mt-1 font-black text-slate-100">{formatCurrency(campaign.revenue)}</p>
                </div>
                <div>
                  <p className="text-slate-500 uppercase tracking-widest">ROAS</p>
                  <p className="mt-1 font-black text-cyan-300">{campaign.roas.toFixed(2)}x</p>
                </div>
                <div>
                  <p className="text-slate-500 uppercase tracking-widest">Lucro</p>
                  <p className={cn("mt-1 font-black", campaign.grossProfit >= 0 ? "text-emerald-300" : "text-red-300")}>
                    {formatCurrency(campaign.grossProfit)}
                  </p>
                </div>
              </div>
            </motion.article>
          ))
        )}
      </div>

      <div className="hidden md:block overflow-x-auto relative z-10 custom-scrollbar-thin">
        <table className="w-full text-left border-separate border-spacing-y-3 min-w-[900px]">
          <caption className="sr-only">Desempenho de Campanhas por Vetor</caption>
          <thead>
            <tr className="text-[10px] uppercase tracking-[0.3em] text-slate-500 font-black">
              <th scope="col" className="px-6 pb-2">Identificador de Campanha</th>
              <th scope="col" className="px-6 pb-2">Unidade Operacional</th>
              <th scope="col" className="px-6 pb-2 text-right">Aporte (Invest.)</th>
              <th scope="col" className="px-6 pb-2 text-right">Retorno (Bruto)</th>
              <th scope="col" className="px-6 pb-2 text-right">Eficiência (ROAS)</th>
              <th scope="col" className="px-6 pb-2 text-right">Resultado Real</th>
              <th scope="col" className="px-6 pb-2 text-right">Estado</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-40 text-center relative overflow-hidden rounded-[2.5rem] bg-white/[0.01] border border-white/[0.03]">
                  <div className="flex flex-col items-center gap-6">
                    <div className="glass w-20 h-20 rounded-full flex items-center justify-center border-white/5 animate-float shadow-2xl">
                      <div className="w-10 h-10 border-2 border-slate-700/50 border-t-cyan-500 rounded-full" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-xs font-black uppercase tracking-[0.5em] text-slate-600 animate-pulse">
                            Nenhuma campanha com dados no periodo
                        </p>
                        <p className="text-[10px] font-bold text-slate-700 uppercase tracking-widest italic">
                            Conecte uma conta Meta ou altere os filtros para visualizar resultados.
                        </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              campaigns.map((campaign, idx) => (
                <motion.tr 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.5, ease: "easeOut" }}
                  key={campaign.campaignId} 
                  className="group/row transition-all duration-500"
                >
                  <td className="px-6 py-5 rounded-l-3xl border-white/[0.04] border-y border-l bg-white/[0.01] group-hover/row:bg-white/[0.07] group-hover/row:border-cyan-500/20 transition-all relative overflow-hidden shadow-sm group-hover/row:shadow-cyan-500/5">
                    <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-cyan-500 opacity-0 group-hover/row:opacity-100 transition-all duration-500 shadow-[0_0_15px_#06b6d4]" />
                    <div className="group-hover/row:translate-x-3 transition-transform duration-500">
                      <p className="text-[13px] font-black text-slate-100 group-hover/row:text-white group-hover/row:drop-shadow-[0_0_8px_rgba(255,255,255,0.2)] transition-all uppercase tracking-wide truncate max-w-[250px]">
                        {campaign.campaignName}
                      </p>
                      <p className="text-[9px] font-bold text-slate-600 mt-1 uppercase tracking-widest font-mono flex items-center gap-2 group-hover/row:text-slate-500">
                        <span className="w-1 h-1 bg-slate-700 rounded-full" />
                        ID: {campaign.campaignId.substring(0, 14)}
                      </p>
                    </div>
                  </td>
                  
                  <td className="px-6 py-5 border-white/[0.04] border-y bg-white/[0.01] group-hover/row:bg-white/[0.07] group-hover/row:border-cyan-500/20 transition-all">
                    <span className="px-3 py-1.5 rounded-xl bg-slate-900/60 border border-white/[0.03] text-[9px] font-black uppercase text-slate-400 tracking-[0.15em] transition-colors group-hover/row:text-slate-300 inline-block overflow-hidden max-w-[140px] truncate shadow-inner">
                      {campaign.accountName}
                    </span>
                  </td>
                  
                  <td className="px-6 py-5 text-right border-white/[0.04] border-y bg-white/[0.01] group-hover/row:bg-white/[0.07] group-hover/row:border-cyan-500/20 transition-all">
                    <span className="text-xs font-black text-slate-400 tracking-tight font-mono group-hover/row:text-slate-200 transition-colors">
                      {formatCurrency(campaign.spend)}
                    </span>
                  </td>
                  
                  <td className="px-6 py-5 text-right border-white/[0.04] border-y bg-white/[0.01] group-hover/row:bg-white/[0.07] group-hover/row:border-cyan-500/20 transition-all">
                    <span className="text-sm font-black text-white tracking-tighter font-mono group-hover/row:drop-shadow-[0_0_10px_rgba(255,255,255,0.4)] transition-all">
                      {formatCurrency(campaign.revenue)}
                    </span>
                  </td>
                  
                  <td className="px-6 py-5 text-right border-white/[0.04] border-y bg-white/[0.01] group-hover/row:bg-white/[0.07] group-hover/row:border-cyan-500/20 transition-all">
                    <div className="flex flex-col items-end">
                      <span
                        className={cn(
                          "text-base font-black font-mono transition-all duration-500",
                          campaign.roas >= 2
                            ? "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.3)] group-hover/row:drop-shadow-[0_0_15px_rgba(52,211,153,0.6)]"
                            : campaign.roas >= 1.2
                              ? "text-cyan-400 drop-shadow-[0_0_10px_rgba(6,189,212,0.3)] group-hover/row:drop-shadow-[0_0_15px_rgba(6,189,212,0.6)]"
                              : "text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.3)] group-hover/row:drop-shadow-[0_0_15px_rgba(251,191,36,0.6)]"
                        )}
                      >
                        {campaign.roas.toFixed(2)}<span className="text-[10px] ml-0.5 opacity-60">x</span>
                      </span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-5 text-right border-white/[0.04] border-y bg-white/[0.01] group-hover/row:bg-white/[0.07] group-hover/row:border-cyan-500/20 transition-all">
                    <span
                      className={cn(
                        "text-xs font-black font-mono transition-all duration-500",
                        campaign.grossProfit >= 0 
                          ? "text-emerald-400 group-hover/row:text-emerald-300" 
                          : "text-red-400 group-hover/row:text-red-300",
                      )}
                    >
                      {formatCurrency(campaign.grossProfit)}
                    </span>
                  </td>
                  
                  <td className="px-6 py-5 text-right rounded-r-3xl border-white/[0.04] border-y border-r bg-white/[0.01] group-hover/row:bg-white/[0.07] group-hover/row:border-cyan-500/20 transition-all w-36">
                    <div className="flex justify-end">
                      <div
                        className={cn(
                          "px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] relative overflow-hidden transition-all duration-500 group-hover/row:shadow-2xl",
                          campaign.status === "ACTIVE"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)] group-hover/row:bg-emerald-500/20"
                            : "bg-slate-800/40 text-slate-500 border border-slate-700/50",
                        )}
                      >
                        {campaign.status === "ACTIVE" && (
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent -translate-x-full animate-[scan_3s_ease-in-out_infinite]" />
                        )}
                        <span className="relative z-10">{statusLabel(campaign.status)}</span>
                      </div>
                    </div>
                  </td>
                </motion.tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Table Footer / Visual Finish */}
      {campaigns.length > 0 && (
        <div className="mt-8 flex items-center justify-between px-2 relative z-10 opacity-60 hover:opacity-100 transition-opacity">
            <div className="text-[9px] font-bold text-slate-600 uppercase tracking-[0.3em]">
                Atualizado em {new Date().toLocaleTimeString("pt-BR")}
            </div>
            <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="w-1 h-1 bg-slate-800 rounded-full" />
                ))}
            </div>
        </div>
      )}
    </section>
  );
}
