/**
 * @start-metric/meta-api
 * Funções para OAuth do Meta (Facebook)
 */

import { MetaApiError } from './client.js';
import type { TokenExchangeResponse } from './types.js';

const GRAPH_API_BASE = 'https://graph.facebook.com/v20.0';

/**
 * Troca um code de autorização OAuth por um access_token de longa duração.
 * Endpoint: GET /oauth/access_token
 *
 * @param code - OAuth authorization code
 * @param redirectUri - URI de redirect configurada no app Meta
 * @returns Access token e tempo de expiração
 *
 * @example
 * ```ts
 * const { accessToken, expiresIn } = await exchangeCodeForToken(code, 'https://...');
 * ```
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; expiresIn: number }> {
  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error(
      'META_APP_ID e META_APP_SECRET devem estar configurados nas variáveis de ambiente',
    );
  }

  const url = new URL(`${GRAPH_API_BASE}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('code', code);

  const res = await fetch(url.toString());
  const data = (await res.json()) as TokenExchangeResponse | { error: { message: string; code: number } };

  if (!res.ok || 'error' in data) {
    const err = 'error' in data ? data.error : { message: 'Failed to exchange code', code: res.status };
    throw new MetaApiError(err.message, err.code);
  }

  const token = data as TokenExchangeResponse;
  return {
    accessToken: token.access_token,
    expiresIn: token.expires_in,
  };
}

/**
 * Gera a URL de OAuth para autorização do usuário.
 *
 * @param redirectUri - URI de redirecionamento configurada no app Meta
 * @param state - String aleatória para CSRF protection
 * @param scopes - Escopos de permissão solicitados
 * @returns URL completa para redirecionar o usuário
 *
 * @example
 * ```ts
 * const authUrl = getOAuthUrl('https://app.com/callback', 'random-state', ['ads_read', 'ads_management']);
 * ```
 */
export function getOAuthUrl(
  redirectUri: string,
  state: string,
  scopes: string[] = ['ads_read', 'ads_management'],
): string {
  const appId = process.env.META_APP_ID;

  if (!appId) {
    throw new Error('META_APP_ID deve estar configurado nas variáveis de ambiente');
  }

  const url = new URL(`${GRAPH_API_BASE}/oauth/authorize`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('scope', scopes.join(','));
  url.searchParams.set('response_type', 'code');

  return url.toString();
}
