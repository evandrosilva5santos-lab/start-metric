/**
 * @start-metric/meta-api
 * Cliente Meta Graph API unificado
 *
 * Pacote reutilizável para interagir com Meta Ads API.
 * Pode ser usado em qualquer app (frontend server-side, backend, workers).
 *
 * @example
 * ```ts
 * import { metaClient } from '@start-metric/meta-api';
 *
 * const accounts = await metaClient.fetchAdAccounts(token);
 * const campaigns = await metaClient.fetchCampaigns(adAccountId, token);
 * ```
 */

export * from './types.js';
export * from './client.js';
export * from './oauth.js';
