/**
 * @start-metric/whatsapp
 * Templates de mensagens para relatórios e notificações
 */

/**
 * Formata um número monetário em BRL
 */
function formatMoney(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Template para relatório diário de campanhas
 */
export function dailyReportTemplate(data: {
  orgName: string;
  dateFrom: string;
  dateTo: string;
  totalSpend: number;
  totalRevenue: number;
  totalProfit: number;
  roas: number;
  conversions: number;
  topCampaigns?: Array<{ name: string; profit: number; roas: number }>;
}): string {
  const lines = [
    `📊 *Relatório Diário — ${data.orgName}*`,
    `📅 ${data.dateFrom === data.dateTo ? data.dateFrom : `${data.dateFrom} → ${data.dateTo}`}`,
    ``,
    `💸 Gasto: ${formatMoney(data.totalSpend)}`,
    `💰 Receita: ${formatMoney(data.totalRevenue)}`,
    `✅ Lucro: ${formatMoney(data.totalProfit)}`,
    `📈 ROAS: ${data.roas.toFixed(2)}x`,
    `🛒 Conversões: ${data.conversions}`,
  ];

  if (data.topCampaigns && data.topCampaigns.length > 0) {
    lines.push(``, `🏆 *Top Campanhas*`);
    for (const c of data.topCampaigns.slice(0, 3)) {
      lines.push(`• ${c.name}: ${formatMoney(c.profit)} (${c.roas.toFixed(2)}x)`);
    }
  }

  lines.push(``, `_${new Date().toLocaleString('pt-BR')}_`);

  return lines.join('\n');
}

/**
 * Template para alerta de ROAS abaixo do mínimo
 */
export function roasAlertTemplate(data: {
  campaignName: string;
  currentRoas: number;
  minRoas: number;
  spend: number;
}): string {
  return [
    `⚠️ *Alerta de ROAS*`,
    ``,
    `Campanha: ${data.campaignName}`,
    `ROAS atual: ${data.currentRoas.toFixed(2)}x`,
    `Mínimo esperado: ${data.minRoas.toFixed(2)}x`,
    `Gasto total: ${formatMoney(data.spend)}`,
    ``,
    `_Verifique sua campanha no dashboard._`,
  ].join('\n');
}

/**
 * Template para alerta de gasto sem conversão
 */
export function spendNoConversionTemplate(data: {
  campaignName: string;
  spend: number;
  hours: number;
}): string {
  return [
    `🚨 *Gasto sem Conversão*`,
    ``,
    `Campanha: ${data.campaignName}`,
    `Gasto: ${formatMoney(data.spend)}`,
    `Período: últimas ${data.hours}h sem conversões`,
    ``,
    `_Revise o criativo ou público-alvo._`,
  ].join('\n');
}
