export type DashboardFilters = {
  from?: string;
  to?: string;
  adAccountId?: string;
  campaignStatus?: string;
};

export type DashboardKpis = {
  adSpend: number;
  revenueAttributed: number;
  attributedConversions: number;
  impressions: number;
  clicks: number;
  grossProfit: number;
  roas: number;
  cpa: number;
  roi: number;
};

export type DashboardChartPoint = {
  date: string;
  spend: number;
  revenue: number;
  profit: number;
};

export type DashboardCampaignRow = {
  campaignId: string;
  campaignName: string;
  accountId: string;
  accountName: string;
  status: string;
  spend: number;
  revenue: number;
  conversions: number;
  impressions: number;
  clicks: number;
  roas: number;
  cpa: number;
  grossProfit: number;
  roi: number;
};

export type DashboardAccountOption = {
  id: string;
  name: string;
  externalId: string;
  timezone: string | null;
};

export type DashboardData = {
  timezone: string;
  range: {
    from: string;
    to: string;
  };
  filters: {
    adAccountId: string;
    campaignStatus: string;
  };
  filterOptions: {
    accounts: DashboardAccountOption[];
    statuses: string[];
  };
  kpis: DashboardKpis;
  chart: DashboardChartPoint[];
  campaigns: DashboardCampaignRow[];
  generatedAt: string;
};
