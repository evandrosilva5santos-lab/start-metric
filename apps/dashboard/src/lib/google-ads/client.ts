// Server-side ONLY. Cliente REST da Google Ads API: credenciais vêm só do ambiente da Vercel
// (nunca do navegador) e são trocadas por access token com escopo adwords.

import { buildServiceAccountAssertion, parseServiceAccount, ADWORDS_SCOPE, type ServiceAccount } from "./jwt";
import { GOOGLE_ADS_API_VERSION, normalizeCustomerId, parseGoogleAdsError, type GoogleAdsErrorKind } from "./gaql";

const API_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}`;
const OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const REQUEST_TIMEOUT_MS = 25_000;
const MAX_PAGES = 50;

export class GoogleAdsApiError extends Error {
  constructor(
    message: string,
    public readonly kind: GoogleAdsErrorKind | "config",
    public readonly code: string | null = null,
  ) {
    super(message);
    this.name = "GoogleAdsApiError";
  }
}

export type GoogleAdsConfig = {
  developerToken: string | null;
  loginCustomerId: string | null;
  serviceAccount: ServiceAccount | null;
  serviceAccountError: string | null;
  oauthClientId: string | null;
  oauthClientSecret: string | null;
};

export function readGoogleAdsConfig(): GoogleAdsConfig {
  let serviceAccount: ServiceAccount | null = null;
  let serviceAccountError: string | null = null;
  const raw = process.env.GOOGLE_ADS_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      serviceAccount = parseServiceAccount(raw);
    } catch (err) {
      serviceAccountError = err instanceof Error ? err.message : "conta de serviço inválida";
    }
  }
  return {
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN?.trim() || null,
    loginCustomerId: normalizeCustomerId(process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? ""),
    serviceAccount,
    serviceAccountError,
    oauthClientId: process.env.GOOGLE_ADS_CLIENT_ID?.trim() || null,
    oauthClientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET?.trim() || null,
  };
}

/** O que existe na configuração, sem expor valores (para a tela de integração). */
export function configChecklist(config = readGoogleAdsConfig()) {
  return {
    developerToken: Boolean(config.developerToken),
    loginCustomerId: config.loginCustomerId,
    serviceAccountEmail: config.serviceAccount?.clientEmail ?? null,
    serviceAccountError: config.serviceAccountError,
    oauthClient: Boolean(config.oauthClientId && config.oauthClientSecret),
  };
}

export type GoogleCredential =
  | { mode: "service_account"; serviceAccount: ServiceAccount }
  | { mode: "oauth"; refreshToken: string };

const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function postForm(url: string, form: Record<string, string>): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const reason = typeof body.error_description === "string" ? body.error_description : String(body.error ?? res.status);
    throw new GoogleAdsApiError(`Google recusou a credencial: ${reason}`, "auth", typeof body.error === "string" ? body.error : null);
  }
  return body;
}

export async function getAccessToken(credential: GoogleCredential, config = readGoogleAdsConfig()): Promise<string> {
  const cacheKey = credential.mode === "service_account" ? `sa:${credential.serviceAccount.clientEmail}` : `oauth:${credential.refreshToken.slice(-12)}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

  let body: Record<string, unknown>;
  if (credential.mode === "service_account") {
    const assertion = buildServiceAccountAssertion(credential.serviceAccount, Math.floor(Date.now() / 1000));
    body = await postForm(credential.serviceAccount.tokenUri, {
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    });
  } else {
    if (!config.oauthClientId || !config.oauthClientSecret) {
      throw new GoogleAdsApiError("OAuth do Google não configurado (GOOGLE_ADS_CLIENT_ID/SECRET).", "config");
    }
    body = await postForm(OAUTH_TOKEN_URL, {
      grant_type: "refresh_token",
      refresh_token: credential.refreshToken,
      client_id: config.oauthClientId,
      client_secret: config.oauthClientSecret,
    });
  }
  const token = typeof body.access_token === "string" ? body.access_token : null;
  if (!token) throw new GoogleAdsApiError("Google não devolveu access token.", "auth");
  const expiresIn = typeof body.expires_in === "number" ? body.expires_in : 3600;
  tokenCache.set(cacheKey, { token, expiresAt: Date.now() + expiresIn * 1000 });
  return token;
}

export async function exchangeOAuthCode(code: string, redirectUri: string, config = readGoogleAdsConfig()) {
  if (!config.oauthClientId || !config.oauthClientSecret) {
    throw new GoogleAdsApiError("OAuth do Google não configurado (GOOGLE_ADS_CLIENT_ID/SECRET).", "config");
  }
  const body = await postForm(OAUTH_TOKEN_URL, {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: config.oauthClientId,
    client_secret: config.oauthClientSecret,
  });
  const refreshToken = typeof body.refresh_token === "string" ? body.refresh_token : null;
  if (!refreshToken) throw new GoogleAdsApiError("O Google não devolveu refresh token. Remova o acesso do app na conta Google e conecte de novo.", "auth");
  const idToken = typeof body.id_token === "string" ? body.id_token : null;
  let email: string | null = null;
  if (idToken) {
    try {
      email = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString()).email ?? null;
    } catch {
      email = null;
    }
  }
  return { refreshToken, email };
}

export function oauthScopes(): string {
  return ["openid", "email", ADWORDS_SCOPE].join(" ");
}

type SearchOptions = { accessToken: string; developerToken: string; loginCustomerId: string | null };

function headers({ accessToken, developerToken, loginCustomerId }: SearchOptions): Record<string, string> {
  const h: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) h["login-customer-id"] = loginCustomerId;
  return h;
}

async function throwApiError(res: Response): Promise<never> {
  const body = await res.json().catch(() => null);
  const info = parseGoogleAdsError(res.status, body);
  throw new GoogleAdsApiError(info.message, info.kind, info.code);
}

export async function searchAll(customerId: string, query: string, options: SearchOptions): Promise<Array<Record<string, Record<string, unknown>>>> {
  const rows: Array<Record<string, Record<string, unknown>>> = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(`${API_BASE}/customers/${customerId}/googleAds:search`, {
      method: "POST",
      headers: headers(options),
      body: JSON.stringify(pageToken ? { query, pageToken } : { query }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) await throwApiError(res);
    const body = (await res.json()) as { results?: Array<Record<string, Record<string, unknown>>>; nextPageToken?: string };
    rows.push(...(body.results ?? []));
    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }
  return rows;
}

export async function listAccessibleCustomers(options: Omit<SearchOptions, "loginCustomerId">): Promise<string[]> {
  const res = await fetch(`${API_BASE}/customers:listAccessibleCustomers`, {
    headers: headers({ ...options, loginCustomerId: null }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) await throwApiError(res);
  const body = (await res.json()) as { resourceNames?: string[] };
  return (body.resourceNames ?? []).map((name) => name.split("/").at(-1) ?? "").filter((id) => /^\d{10}$/.test(id));
}
