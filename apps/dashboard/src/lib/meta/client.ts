// lib/meta/client.ts — Server-side ONLY
// Nunca importe este arquivo em Client Components.
// Todas as chamadas à Graph API passam por aqui.

const GRAPH_API_BASE = "https://graph.facebook.com/v20.0";
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 500;

// ── Types ──────────────────────────────────────────────────

export interface MetaCampaign {
  id: string;
  name: string;
  status: string;
  objective: string;
  daily_budget?: string;
}

export interface MetaInsight {
  campaign_id: string;
  date_start: string;
  spend: string;
  impressions: string;
  clicks: string;
  conversions?: number;
  revenue?: number;
}

export interface MetaDateRange {
  since: string; // YYYY-MM-DD
  until: string; // YYYY-MM-DD
}

interface GraphApiError {
  error: {
    message: string;
    type: string;
    code: number;
    fbtrace_id?: string;
  };
}

// ── Retry helper ──────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  attempt = 1
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

// ── Core fetch ────────────────────────────────────────────

async function graphFetch<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${GRAPH_API_BASE}${path}`);
  url.searchParams.set("access_token", token);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }

  const res = await fetchWithRetry(url.toString());
  const data = await res.json() as T | GraphApiError;

  if (!res.ok || "error" in (data as object)) {
    const err = (data as GraphApiError).error;
    throw new MetaApiError(
      err?.message ?? `Graph API error ${res.status}`,
      err?.code ?? res.status,
      err?.fbtrace_id
    );
  }

  return data as T;
}

// ── Custom error ─────────────────────────────────────────

export class MetaApiError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly traceId?: string
  ) {
    super(message);
    this.name = "MetaApiError";
  }

  isTokenExpired() {
    // Código 190 = token inválido/expirado
    return this.code === 190;
  }

  isRateLimited() {
    // Código 17 = user request limit / 4 = application request limit
    return this.code === 17 || this.code === 4;
  }
}

// ── Public API ────────────────────────────────────────────

/**
 * Busca campanhas de uma conta de anúncios Meta.
 * Endpoint: GET /{ad_account_id}/campaigns
 */
export async function fetchCampaigns(
  adAccountId: string,
  token: string
): Promise<MetaCampaign[]> {
  const data = await graphFetch<{ data: MetaCampaign[] }>(
    `/${adAccountId}/campaigns`,
    token,
    {
      fields: "id,name,status,objective,daily_budget",
      limit: "500",
    }
  );
  return data.data ?? [];
}

/**
 * Busca insights (métricas) de uma conta num range de datas.
 * Endpoint: GET /{ad_account_id}/insights
 */
export async function fetchInsights(
  adAccountId: string,
  token: string,
  dateRange: MetaDateRange
): Promise<MetaInsight[]> {
  const data = await graphFetch<{ data: MetaInsight[] }>(
    `/${adAccountId}/insights`,
    token,
    {
      fields: "campaign_id,date_start,spend,impressions,clicks,actions",
      time_range: JSON.stringify(dateRange),
      level: "campaign",
      time_increment: "1",
      limit: "500",
    }
  );
  return data.data ?? [];
}

/**
 * Verifica se o token está ativo e retorna informações básicas.
 * Útil para checar expiração antes de um sync.
 */
export async function validateToken(token: string): Promise<{ isValid: boolean; expiresAt?: Date }> {
  try {
    const data = await graphFetch<{ id: string; data_access_expires_at?: number }>(
      "/me",
      token,
      { fields: "id,data_access_expires_at" }
    );

    const expiresAt = data.data_access_expires_at
      ? new Date(data.data_access_expires_at * 1000)
      : undefined;

    return { isValid: true, expiresAt };
  } catch (err) {
    if (err instanceof MetaApiError && err.isTokenExpired()) {
      return { isValid: false };
    }
    throw err;
  }
}

/**
 * Troca um code de autorização OAuth por um access_token de longa duração.
 * Chamado apenas no callback server-side.
 */
export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const appId = process.env.META_APP_ID!;
  const appSecret = process.env.META_APP_SECRET!;

  const url = new URL(`${GRAPH_API_BASE}/oauth/access_token`);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("client_secret", appSecret);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code", code);

  const res = await fetchWithRetry(url.toString());
  const data = await res.json() as { access_token: string; expires_in: number } | GraphApiError;

  if (!res.ok || "error" in (data as object)) {
    const err = (data as GraphApiError).error;
    throw new MetaApiError(err?.message ?? "Failed to exchange code", err?.code ?? res.status);
  }

  const token = data as { access_token: string; expires_in: number };
  return { accessToken: token.access_token, expiresIn: token.expires_in };
}

/**
 * Busca as contas de anúncios vinculadas ao token do usuário.
 */
export async function fetchAdAccounts(token: string): Promise<{ id: string; name: string; currency: string; timezone_name: string }[]> {
  const data = await graphFetch<{ data: { id: string; name: string; currency: string; timezone_name: string }[] }>(
    "/me/adaccounts",
    token,
    { fields: "id,name,currency,timezone_name", limit: "50" }
  );
  return data.data ?? [];
}
