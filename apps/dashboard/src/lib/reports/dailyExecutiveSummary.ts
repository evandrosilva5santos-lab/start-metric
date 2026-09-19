export interface DailyExecutiveMetrics {
  date: string;
  clientName: string;
  totalSpend: number;
  totalRevenue: number;
  roas: number;
  cpa: number;
  leadsCount: number;
  salesCount: number;
  activeCampaignsCount: number;
  alertsTriggered?: string[];
  topCampaign?: {
    name: string;
    roas: number;
    spend: number;
  };
}

/**
 * Formata um relatório executivo diário pronto para envio no WhatsApp do cliente/gestor.
 */
export function formatDailyWhatsAppReport(m: DailyExecutiveMetrics): string {
  const formatCurrency = (val: number) =>
    val.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatNumber = (val: number) => val.toLocaleString("pt-BR");

  const emojiRoas = m.roas >= 4 ? "🔥" : m.roas >= 2 ? "✅" : "⚠️";

  let msg = `📊 *RESUMO EXECUTIVO DIÁRIO — ${m.clientName.toUpperCase()}*\n`;
  msg += `📅 *Data:* ${m.date}\n\n`;

  msg += `💰 *Investimento Total:* ${formatCurrency(m.totalSpend)}\n`;
  msg += `💵 *Faturamento Gerado:* ${formatCurrency(m.totalRevenue)}\n`;
  msg += `${emojiRoas} *ROAS:* ${m.roas.toFixed(2)}x\n`;
  msg += `🎯 *CPA Médio:* ${formatCurrency(m.cpa)}\n`;
  msg += `👥 *Leads Captados:* ${formatNumber(m.leadsCount)}\n`;
  msg += `🛒 *Vendas Realizadas:* ${formatNumber(m.salesCount)}\n\n`;

  if (m.topCampaign) {
    msg += `🏆 *Melhor Campanha:* ${m.topCampaign.name}\n`;
    msg += `   └ Investido: ${formatCurrency(m.topCampaign.spend)} | ROAS: ${m.topCampaign.roas.toFixed(2)}x\n\n`;
  }

  if (m.alertsTriggered && m.alertsTriggered.length > 0) {
    msg += `🚨 *Avisos e Oportunidades:*\n`;
    for (const alert of m.alertsTriggered) {
      msg += ` • ${alert}\n`;
    }
    msg += `\n`;
  }

  msg += `🤖 *Gerado automaticamente por Start Metric.*`;
  return msg;
}
