// @start-metric/types
// Tipos compartilhados entre frontend e backend

// ============================================================================
// META ADS TYPES
// ============================================================================

export interface MetaAdAccount {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  account_status: number;
  status: 'active' | 'expired' | 'disconnected';
}

export interface MetaCampaign {
  id: string;
  name: string;
  adaccount_id: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  daily_budget: number;
  lifetime_budget: number | null;
  start_time: string;
  stop_time: string | null;
  created_time: string;
  updated_time: string;
}

export interface MetaInsights {
  date_start: string;
  date_stop: string;
  impressions: number;
  clicks: number;
  spend: number;
  actions: MetaAction[];
  cost_per_action_type: MetaAction[];
}

export interface MetaAction {
  action_type: string;
  value: number;
  '1d_click': number;
  '28d_click': number;
}

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

export interface DashboardData {
  campaigns: CampaignWithMetrics[];
  kpis: KpiData;
  chart: ChartData;
  filterOptions: FilterOptions;
  range: DateRange;
  filters: ActiveFilters;
  generatedAt: string;
}

export interface CampaignWithMetrics {
  id: string;
  name: string;
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  daily_budget: number;
  start_date: string;
  metrics: {
    spend: number;
    impressions: number;
    clicks: number;
    conversions: number;
    revenue: number;
    roas: number;
    cpa: number;
    profit: number;
    profit_margin: number;
  };
}

export interface KpiData {
  total_spend: number;
  total_revenue: number;
  total_conversions: number;
  avg_roas: number;
  avg_cpa: number;
  total_profit: number;
  profit_margin: number;
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color: string;
  }[];
}

export interface FilterOptions {
  adAccounts: Array<{ id: string; name: string }>;
  dateRanges: Array<{ id: string; name: string; from: string; to: string }>;
}

export interface DateRange {
  from: string;
  to: string;
}

export interface ActiveFilters {
  adAccountId: string;
  campaignStatus: string;
}

// ============================================================================
// ALERTS TYPES
// ============================================================================

export interface Alert {
  id: string;
  type: 'roas' | 'cpa' | 'spend_no_conversion';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  campaign_id: string | null;
  campaign_name: string | null;
  created_at: string;
  read_at: string | null;
  resolved_at: string | null;
}

export interface AlertRule {
  id: string;
  name: string;
  type: 'roas' | 'cpa' | 'spend_no_conversion';
  conditions: {
    threshold?: number;
    operator?: 'less_than' | 'greater_than';
    hours_without_conversion?: number;
  };
  campaign_id: string | null; // null = applies to all campaigns
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// ATTRIBUTION TYPES (Feature 1)
// ============================================================================

export interface Order {
  id: string;
  org_id: string;
  stripe_checkout_session_id: string;
  stripe_payment_intent_id: string;
  amount_subtotal: number;
  amount_tax: number;
  amount_total: number;
  amount_refunded: number;
  currency: string;
  status: 'pending' | 'complete' | 'refunded' | 'failed';
  metadata: OrderMetadata;
  created_at: string;
  updated_at: string;
}

export interface OrderMetadata {
  click_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  gclid?: string;
}

export interface Attribution {
  id: string;
  org_id: string;
  order_id: string;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  attribution_model: 'last_click' | 'first_click' | 'linear';
  revenue_attributed: number;
  attributed_at: string;
  created_at: string;
}

export interface TrackingSession {
  id: string;
  org_id: string;
  click_id: string;
  campaign_id: string | null;
  adset_id: string | null;
  ad_id: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  fbc: string | null;
  fbp: string | null;
  ip_address: string | null;
  user_agent: string | null;
  landed_at: string;
  converted_at: string | null;
}

// ============================================================================
// REPORTS TYPES (Feature 2)
// ============================================================================

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  variables: TemplateVariable[];
  layout: ReportLayout;
  created_at: string;
  updated_at: string;
}

export interface TemplateVariable {
  key: string;
  label: string;
  type: 'text' | 'number' | 'currency' | 'percentage' | 'date';
  default_value?: string | number;
}

export interface ReportLayout {
  sections: ReportSection[];
}

export interface ReportSection {
  type: 'header' | 'kpi_grid' | 'chart' | 'table' | 'footer';
  title?: string;
  content?: Record<string, unknown>;
}

export interface ScheduledReport {
  id: string;
  org_id: string;
  template_id: string;
  name: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[]; // email addresses
  whatsapp_enabled: boolean;
  next_run_at: string;
  last_run_at: string | null;
  status: 'active' | 'paused' | 'error';
  created_at: string;
  updated_at: string;
}

export interface ReportExecution {
  id: string;
  scheduled_report_id: string;
  org_id: string;
  status: 'pending' | 'generating' | 'completed' | 'failed';
  generated_at: string | null;
  sent_at: string | null;
  error_message: string | null;
  file_url: string | null;
  created_at: string;
}

export interface AggregatedMetrics {
  period: DateRange;
  by_campaign: Array<{
    campaign_id: string;
    campaign_name: string;
    spend: number;
    revenue: number;
    roas: number;
    conversions: number;
    profit: number;
  }>;
  by_adset: Array<{
    adset_id: string;
    adset_name: string;
    spend: number;
    revenue: number;
    roas: number;
    conversions: number;
  }>;
  totals: {
    spend: number;
    revenue: number;
    roas: number;
    conversions: number;
    profit: number;
  };
}

// ============================================================================
// WHATSAPP TYPES (Feature 3)
// ============================================================================

export interface WhatsAppInstance {
  id: string;
  org_id: string;
  instance_name: string;
  api_url: string;
  api_key: string;
  phone_number: string;
  status: 'connected' | 'disconnected' | 'error';
  webhook_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface WhatsAppMessage {
  id: string;
  org_id: string;
  instance_id: string;
  report_execution_id: string | null;
  to: string;
  message: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  error_message: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
}

export interface WhatsAppTemplate {
  id: string;
  org_id: string;
  name: string;
  content: string;
  variables: string[];
  created_at: string;
  updated_at: string;
}
