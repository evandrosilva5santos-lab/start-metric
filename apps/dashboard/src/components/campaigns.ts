import type { DashboardCampaignRow as Campaign } from "@/lib/dashboard/types";

export const getCampaigns = async (): Promise<Campaign[]> => {
  return [
    {
      campaignId: "test-123",
      campaignName: "Campanha de Teste (Mock)",
      accountId: "acc-123",
      accountName: "Conta Principal",
      status: "ACTIVE",
      spend: 1500.50,
      revenue: 4500.00,
      conversions: 120,
      impressions: 50000,
      clicks: 1200,
      roas: 3.0,
      cpa: 12.50,
      grossProfit: 2999.50,
      roi: 1.99
    }
  ];
};
