export type DashboardFilters = {
  from?: string;
  to?: string;
  adAccountId?: string;
  campaignStatus?: string;
  clientId?: string;
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

export type DashboardClientOption = {
  id: string;
  name: string;
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
    clientId: string;
  };
  filterOptions: {
    accounts: DashboardAccountOption[];
    statuses: string[];
    clients: DashboardClientOption[];
  };
  kpis: DashboardKpis;
  chart: DashboardChartPoint[];
  campaigns: DashboardCampaignRow[];
  metrics: {
    activeCampaigns: number;
    totalCampaigns: number;
  };
  userProfile?: {
    name: string | null;
  };
  generatedAt: string;
};
