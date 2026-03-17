"use client";

import { motion } from "framer-motion";
import { Download, Share2, Lock } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface Client {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  org_id: string;
}

interface Organization {
  id: string;
  name: string;
  logo_url: string | null;
}

interface DailyMetric {
  date: string;
  spend: number | null;
  conversions: number | null;
  roas: number | null;
  clicks: number | null;
  impressions: number | null;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  daily_metrics: DailyMetric[];
}

interface SharedDashboardClientProps {
  token: string;
  client: Client;
  organization: Organization;
  campaigns: Campaign[];
  accessType: string;
}

export default function SharedDashboardClient({
  token,
  client,
  organization,
  campaigns,
  accessType,
}: SharedDashboardClientProps) {
  // Agregar métricas
  const aggregatedMetrics = campaigns.reduce(
    (acc, campaign) => {
      campaign.daily_metrics.forEach((metric) => {
        acc.totalSpend += metric.spend || 0;
        acc.totalConversions += metric.conversions || 0;
        acc.totalClicks += metric.clicks || 0;
        acc.totalImpressions += metric.impressions || 0;
      });
      return acc;
    },
    {
      totalSpend: 0,
      totalConversions: 0,
      totalClicks: 0,
      totalImpressions: 0,
    }
  );

  const avgRoas =
    aggregatedMetrics.totalSpend > 0
      ? aggregatedMetrics.totalConversions / aggregatedMetrics.totalSpend
      : 0;

  const ctr =
    aggregatedMetrics.totalImpressions > 0
      ? (aggregatedMetrics.totalClicks / aggregatedMetrics.totalImpressions) * 100
      : 0;

  const cpc =
    aggregatedMetrics.totalClicks > 0
      ? aggregatedMetrics.totalSpend / aggregatedMetrics.totalClicks
      : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header com marca branca */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-slate-800 border-b border-slate-700 sticky top-0 z-10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Logo e nome */}
            <div className="flex items-center gap-3">
              {organization.logo_url && (
                <img
                  src={organization.logo_url}
                  alt={organization.name}
                  className="w-8 h-8 rounded"
                />
              )}
              <div>
                <p className="text-xs text-slate-400">{organization.name}</p>
                <h1 className="text-lg font-bold text-white">{client.name}</h1>
              </div>
            </div>

            {/* Botões */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  // Copiar URL
                  const url = window.location.href;
                  navigator.clipboard.writeText(url);
                  alert("URL copiada!");
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">Compartilhar</span>
              </button>

              <button className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Baixar PDF</span>
              </button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPIs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8"
        >
          {/* Spend */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <p className="text-sm text-slate-400 mb-1">Gastos Totais</p>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(aggregatedMetrics.totalSpend)}
            </p>
            <p className="text-xs text-slate-500 mt-2">Últimos 14 dias</p>
          </div>

          {/* Conversions */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <p className="text-sm text-slate-400 mb-1">Conversões</p>
            <p className="text-2xl font-bold text-white">
              {formatNumber(aggregatedMetrics.totalConversions)}
            </p>
            <p className="text-xs text-slate-500 mt-2">Total de conversões</p>
          </div>

          {/* ROAS */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <p className="text-sm text-slate-400 mb-1">ROAS</p>
            <p className="text-2xl font-bold text-white">
              {avgRoas.toFixed(2)}x
            </p>
            <p className="text-xs text-slate-500 mt-2">Retorno do investimento</p>
          </div>

          {/* CPC */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <p className="text-sm text-slate-400 mb-1">CPC</p>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(cpc)}
            </p>
            <p className="text-xs text-slate-500 mt-2">Por clique</p>
          </div>

          {/* CTR */}
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-4">
            <p className="text-sm text-slate-400 mb-1">CTR</p>
            <p className="text-2xl font-bold text-white">
              {ctr.toFixed(2)}%
            </p>
            <p className="text-xs text-slate-500 mt-2">Taxa de cliques</p>
          </div>
        </motion.div>

        {/* Campanhas */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden"
        >
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-lg font-bold text-white">Campanhas Ativas</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-700/50 border-b border-slate-700">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-slate-300">
                    Nome
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">
                    Gastos
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">
                    Conversões
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-slate-300">
                    ROAS
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-medium text-slate-300">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {campaigns.length > 0 ? (
                  campaigns.map((campaign) => {
                    const spend = campaign.daily_metrics.reduce((acc, m) => acc + (m.spend || 0), 0);
                    const conversions = campaign.daily_metrics.reduce(
                      (acc, m) => acc + (m.conversions || 0),
                      0
                    );
                    const roas = spend > 0 ? conversions / spend : 0;

                    return (
                      <tr key={campaign.id} className="hover:bg-slate-700/50 transition-colors">
                        <td className="px-4 py-3 text-sm text-white">{campaign.name}</td>
                        <td className="px-4 py-3 text-sm text-right text-white font-medium">
                          {formatCurrency(spend)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-white">
                          {formatNumber(conversions)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-white">
                          {roas.toFixed(2)}x
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              campaign.status === "active"
                                ? "bg-green-500/20 text-green-300"
                                : "bg-slate-600 text-slate-300"
                            }`}
                          >
                            {campaign.status === "active" ? "Ativa" : "Pausada"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      Nenhuma campanha encontrada
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="mt-8 text-center text-slate-400 text-sm">
          <p className="flex items-center justify-center gap-1">
            <Lock className="w-3 h-3" />
            Este dashboard é seguro e pode ser compartilhado apenas com pessoas autorizadas
          </p>
        </div>
      </div>
    </div>
  );
}
