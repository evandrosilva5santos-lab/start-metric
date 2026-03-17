export type DashboardFilters = {
  from?: string;
  to?: string;
  adAccountId?: string;
  campaignStatus?: string;
  clientId?: string;
  campaignStatuses?: string[];
  campaignObjectives?: string[];
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
  cpm: number;
  ctr: number;
  cpc: number;
  isDataReal: boolean;
};

export type KPIComparison = {
  value: number;
  previousValue: number;
  direction: "up" | "down" | "neutral";
  percentChange: number;
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
  clientId?: string;
  clientName?: string;
  status: string;
  objective?: string;
  spend: number;
  revenue: number;
  conversions: number;
  impressions: number;
  clicks: number;
  roas: number;
  cpa: number;
  grossProfit: number;
  roi: number;
  cpm: number;
  ctr: number;
  cpc: number;
};

export type DashboardAccountOption = {
  id: string;
  name: string;
  externalId: string;
  timezone: string | null;
  lastSyncedAt: string | null;
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
    objectives?: string[];
    clients: DashboardClientOption[];
  };
  kpis: DashboardKpis;
  kpisComparison?: {
    roas: KPIComparison;
    cpa?: KPIComparison;
    cpm?: KPIComparison;
    ctr?: KPIComparison;
  };
  chart: DashboardChartPoint[];
  campaigns: DashboardCampaignRow[];
  metrics: {
    activeCampaigns: number;
    totalCampaigns: number;
  };
  userProfile?: {
    name: string | null;
  };
  lastSyncedAt: string | null;
  generatedAt: string;
};
