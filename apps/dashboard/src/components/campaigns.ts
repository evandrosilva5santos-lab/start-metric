import { createClient } from "@/lib/supabase/client";
import type { DashboardCampaignRow as Campaign } from "@/lib/dashboard/types";

export const getCampaigns = async (): Promise<Campaign[]> => {
    const supabase = createClient();

    const { data, error } = await supabase
        .from('campaigns') // Ajuste para o nome correto da sua tabela ou view
        .select(`
      campaign_id,
      campaign_name,
      account_id,
      account_name,
      status,
      spend,
      revenue,
      conversions,
      impressions,
      clicks,
      roas,
      cpa,
      gross_profit,
      roi
    `);

    if (error) {
        console.error("Erro ao buscar campanhas no Supabase:", error);
        throw new Error(error.message || "Não foi possível carregar as campanhas no momento.");
    }

    // Fazemos o map para garantir a conversão do padrão do banco (snake_case) para o TypeScript (camelCase)
    // Além disso, garantimos que os valores numéricos não venham nulos usando fallback (|| 0)
    return (data || []).map((row: any) => ({
        campaignId: row.campaign_id,
        campaignName: row.campaign_name,
        accountId: row.account_id,
        accountName: row.account_name,
        status: row.status,
        spend: Number(row.spend || 0),
        revenue: Number(row.revenue || 0),
        conversions: Number(row.conversions || 0),
        impressions: Number(row.impressions || 0),
        clicks: Number(row.clicks || 0),
        roas: Number(row.roas || 0),
        cpa: Number(row.cpa || 0),
        grossProfit: Number(row.gross_profit || 0),
        roi: Number(row.roi || 0)
    }));
};
