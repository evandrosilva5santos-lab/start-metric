/**
 * @start-metric/meta-api
 * Cliente HTTP para Meta Graph API
 */

import type {
  MetaAdAccount,
  MetaCampaign,
  MetaInsight,
  MetaDateRange,
  MetaProfile,
  GraphApiError,
  ParsedMetric,
} from './types.js';

const GRAPH_API_BASE = 'https://graph.facebook.com/v20.0';
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 500;

/**
 * Erro da API Graph do Meta
 */
export class MetaApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly traceId?: string,
  ) {
    super(message);
    this.name = 'MetaApiError';
  }

  /**
   * Código 190 = token inválido/expirado
   */
  isTokenExpired(): boolean {
    return this.code === 190;
  }

  /**
   * Código 17 = user request limit / 4 = application request limit
   */
  isRateLimited(): boolean {
    return this.code === 17 || this.code === 4;
  }

  /**
   * Código 500+ = erro transiente
   */
  isTransient(): boolean {
    return this.code >= 500;
  }
}

/**
 * Retry helper com backoff exponencial
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  attempt = 1,
): Promise<Response> {
  const res = await fetch(url, options);

  // Retry apenas em 500/503 (erros transientes da Meta)
  const shouldRetry = (res.status === 500 || res.status === 503) && attempt < MAX_RETRIES;

  if (shouldRetry) {
    const delay = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
    await new Promise((r) => setTimeout(r, delay));
    return fetchWithRetry(url, options, attempt + 1);
  }

  return res;
}

/**
 * Core fetch function para Graph API
 */
async function graphFetch<T>(
  path: string,
  token: string,
  params: Record<string, string> = {},
): Promise<T> {
  const url = new URL(`${GRAPH_API_BASE}${path}`);
  url.searchParams.set('access_token', token);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetchWithRetry(url.toString());
  const data = (await res.json()) as T | GraphApiError;

  if (!res.ok || 'error' in (data as object)) {
    const err = (data as GraphApiError).error;
    throw new MetaApiError(
      err?.message ?? `Graph API error ${res.status}`,
      err?.code ?? res.status,
      err?.fbtrace_id,
    );
  }

  return data as T;
}

/**
 * Cliente Meta Graph API
 *
 * Fornece métodos para interagir com a API do Meta Ads.
 * Todos os métodos fazem retry automático em erros transientes (5xx).
 */
export class MetaClient {
  /**
   * Busca as contas de anúncios vinculadas ao token do usuário.
   * Endpoint: GET /me/adaccounts
   */
  async fetchAdAccounts(token: string): Promise<MetaAdAccount[]> {
    const data = await graphFetch<{ data: MetaAdAccount[] }>(
      '/me/adaccounts',
      token,
      {
        fields: 'id,name,account_status,currency,timezone_name',
        limit: '50',
      },
    );
    return data.data ?? [];
  }

  /**
   * Busca campanhas de uma conta de anúncios Meta.
   * Endpoint: GET /{ad_account_id}/campaigns
   */
  async fetchCampaigns(adAccountId: string, token: string): Promise<MetaCampaign[]> {
    const data = await graphFetch<{ data: MetaCampaign[] }>(
      `/${adAccountId}/campaigns`,
      token,
      {
        fields: 'id,name,status,objective,daily_budget,budget_remaining,start_time,stop_time',
        limit: '500',
      },
    );
    return data.data ?? [];
  }

  /**
   * Busca insights (métricas) de uma conta num range de datas.
   * Endpoint: GET /{ad_account_id}/insights
   */
  async fetchInsights(
    adAccountId: string,
    token: string,
    dateRange: MetaDateRange,
  ): Promise<MetaInsight[]> {
    const data = await graphFetch<{ data: MetaInsight[] }>(
      `/${adAccountId}/insights`,
      token,
      {
        fields: 'campaign_id,campaign_name,date_start,spend,impressions,clicks,actions',
        time_range: JSON.stringify(dateRange),
        level: 'campaign',
        time_increment: '1',
        limit: '500',
      },
    );
    return data.data ?? [];
  }

  /**
   * Busca insights completos com actions e action_values para cálculo de ROAS real.
   * Endpoint: GET /{ad_account_id}/insights
   *
   * Retorna métricas parseadas com conversions, revenue_attributed, roas e cpa calculados.
   */
  async fetchCampaignInsights(
    adAccountId: string,
    token: string,
    datePreset: string = 'last_30d',
  ): Promise<ParsedMetric[]> {
    type InsightRow = {
      campaign_id: string;
      campaign_name: string;
      spend: string;
      impressions: string;
      clicks: string;
      date_start: string;
      date_stop: string;
      actions?: Array<{ action_type: string; value: string }>;
      action_values?: Array<{ action_type: string; value: string }>;
    };

    const data = await graphFetch<{ data: InsightRow[] }>(
      `/${adAccountId}/insights`,
      token,
      {
        fields: 'campaign_id,campaign_name,spend,impressions,clicks,actions,action_values,date_start,date_stop',
        date_preset: datePreset,
        time_increment: '1',
        level: 'campaign',
        limit: '500',
      },
    );

    const rows = data.data ?? [];

    return rows.map((row) => {
      // Extrair conversions de actions (purchase ou omni_purchase)
      const purchaseAction = row.actions?.find(
        (a) => a.action_type === 'purchase' || a.action_type === 'omni_purchase'
      );
      const conversions = purchaseAction ? parseFloat(purchaseAction.value) : 0;

      // Extrair revenue de action_values (purchase ou omni_purchase)
      const purchaseValue = row.action_values?.find(
        (a) => a.action_type === 'purchase' || a.action_type === 'omni_purchase'
      );
      const revenueAttributed = purchaseValue ? parseFloat(purchaseValue.value) : 0;

      // Calcular ROAS e CPA
      const spend = parseFloat(row.spend) || 0;
      const roas = spend > 0 ? revenueAttributed / spend : 0;
      const cpa = conversions > 0 ? spend / conversions : 0;

      return {
        campaign_id: row.campaign_id,
        campaign_name: row.campaign_name,
        date: row.date_start,
        spend,
        impressions: parseInt(row.impressions) || 0,
        clicks: parseInt(row.clicks) || 0,
        conversions,
        revenue_attributed: revenueAttributed,
        roas,
        cpa,
      };
    });
  }

  /**
   * Verifica se o token está ativo e retorna informações básicas.
   * Endpoint: GET /me
   */
  async validateToken(token: string): Promise<{ isValid: boolean; profile?: MetaProfile; expiresAt?: Date }> {
    try {
      const data = await graphFetch<{
        id: string;
        name?: string;
        email?: string;
        data_access_expires_at?: number;
      }>(
        '/me',
        token,
        { fields: 'id,name,email,data_access_expires_at' },
      );

      const expiresAt = data.data_access_expires_at
        ? new Date(data.data_access_expires_at * 1000)
        : undefined;

      return {
        isValid: true,
        profile: {
          id: data.id,
          name: data.name,
          email: data.email,
        },
        expiresAt,
      };
    } catch (err) {
      if (err instanceof MetaApiError && err.isTokenExpired()) {
        return { isValid: false };
      }
      throw err;
    }
  }

  /**
   * Atualiza o status de uma campanha (ACTIVE/PAUSED/ARCHIVED).
   * Endpoint: POST /{campaign_id}
   */
  async updateCampaignStatus(
    campaignId: string,
    token: string,
    status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED',
  ): Promise<{ success: boolean }> {
    await graphFetch<{ success: boolean }>(
      `/${campaignId}`,
      token,
      { status },
    );
    return { success: true };
  }

  /**
   * Atualiza o daily_budget de uma campanha.
   * Endpoint: POST /{campaign_id}
   */
  async updateCampaignBudget(
    campaignId: string,
    token: string,
    dailyBudget: number,
  ): Promise<{ success: boolean }> {
    await graphFetch<{ success: boolean }>(
      `/${campaignId}`,
      token,
      { daily_budget: dailyBudget.toString() },
    );
    return { success: true };
  }
}

/**
 * Instância singleton do cliente
 */
export const metaClient = new MetaClient();
