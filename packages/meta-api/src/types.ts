/**
 * @start-metric/meta-api
 * Tipos para Meta Graph API
 */

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget?: string;
  budget_remaining?: string;
  start_time?: string;
  stop_time?: string;
}

export interface MetaInsight {
  campaign_id: string;
  campaign_name?: string;
  date_start: string;
  date_stop?: string;
  spend: string;
  impressions: string;
  clicks: string;
  actions?: MetaAction[];
  action_values?: MetaActionValue[];
}

/**
 * Ação de conversão da Meta (ex: purchase, lead, etc.)
 */
export interface MetaAction {
  action_type: string;
  value: string;
}

/**
 * Valor monetário de uma ação (ex: purchase revenue)
 */
export interface MetaActionValue {
  action_type: string;
  value: string;
}

/**
 * Insight parseado com métricas calculadas
 */
export interface ParsedMetric {
  campaign_id: string;
  campaign_name?: string;
  date: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue_attributed: number;
  roas: number;
  cpa: number;
}

export interface MetaDateRange {
  since: string; // YYYY-MM-DD
  until: string; // YYYY-MM-DD
}

export interface MetaAdAccount {
  id: string;
  name: string;
  currency: string;
  timezone_name?: string;
  account_status?: number;
}

export interface MetaProfile {
  id: string;
  name?: string;
  email?: string;
}

export interface TokenExchangeResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface GraphApiError {
  error: {
    message: string;
    type: string;
    code: number;
    fbtrace_id?: string;
  };
}
