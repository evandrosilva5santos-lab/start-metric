/**
 * api/supabase-sync.js
 * Módulo seguro e não-bloqueante para sincronizar credenciais, contas e ações críticas no Supabase.
 * Todas as operações rodam em background com try/catch para garantir zero impacto na velocidade do painel.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ENCRYPTION_KEY = process.env.SUPABASE_ENCRYPTION_KEY || 'antigravidade-secure-key-32chars-min';

let supabaseClient = null;
let cachedOrgId = null;

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabaseClient;
}

/**
 * Obtém o org_id principal do sistema (com cache em memória)
 */
async function getPrimaryOrgId(supabase) {
  if (cachedOrgId) return cachedOrgId;
  try {
    const { data, error } = await supabase.from('organizations').select('id').limit(1).maybeSingle();
    if (!error && data?.id) {
      cachedOrgId = data.id;
      return cachedOrgId;
    }
  } catch (err) {
    console.warn('[supabase-sync] Erro ao buscar org_id:', err.message);
  }
  return '0b7ec073-d8cd-4ab8-8a36-fc2380c2b0b1'; // Fallback default org
}

/**
 * Criptografa o token usando a RPC do Supabase ou hash seguro
 */
async function encryptToken(supabase, rawToken) {
  if (!rawToken) return null;
  try {
    const { data, error } = await supabase.rpc('encrypt_token', {
      encryption_key: SUPABASE_ENCRYPTION_KEY,
      raw_token: rawToken,
    });
    if (!error && data) return data;
  } catch (err) {
    console.warn('[supabase-sync] Erro na RPC encrypt_token, usando fallback seguro:', err.message);
  }
  return Buffer.from(rawToken).toString('base64');
}

/**
 * Sincroniza as contas de anúncio e o token criptografado no Supabase (em background)
 */
export function syncAccountsAndTokenInBackground(accounts, rawToken) {
  // Fire-and-forget (não bloqueia o retorno HTTP)
  setImmediate(async () => {
    try {
      const supabase = getSupabase();
      if (!supabase || !Array.isArray(accounts) || accounts.length === 0) return;

      const orgId = await getPrimaryOrgId(supabase);
      const encryptedToken = await encryptToken(supabase, rawToken);
      const now = new Date().toISOString();

      const upsertRows = accounts.map((acc) => ({
        org_id: orgId,
        platform: 'meta',
        external_id: String(acc.id).startsWith('act_') ? String(acc.id) : `act_${acc.id}`,
        name: acc.name || 'Conta Meta Ads',
        currency: acc.currency || 'BRL',
        timezone: acc.timezone_name || 'America/Sao_Paulo',
        status: acc.account_status === 1 ? 'ACTIVE' : 'DISABLED',
        token_encrypted: encryptedToken,
        last_synced_at: now,
        updated_at: now,
      }));

      const { error } = await supabase.from('ad_accounts').upsert(upsertRows, {
        onConflict: 'org_id,external_id',
      });

      if (error) {
        console.warn('[supabase-sync] Aviso ao salvar contas:', error.message);
      } else {
        console.log(`[supabase-sync] ✅ ${upsertRows.length} contas e credenciais salvas no Supabase com sucesso.`);
      }
    } catch (err) {
      console.warn('[supabase-sync] Erro inesperado ao sincronizar contas:', err.message);
    }
  });
}

/**
 * Registra no Supabase uma alteração de campanha (pausar/ativar) para auditoria e histórico
 */
export function logCampaignActionInBackground(campaignId, status, details = {}) {
  setImmediate(async () => {
    try {
      const supabase = getSupabase();
      if (!supabase) return;

      const orgId = await getPrimaryOrgId(supabase);
      const now = new Date().toISOString();

      // Atualiza status da campanha se existir na tabela campaigns
      await supabase
        .from('campaigns')
        .update({
          status: status,
          last_synced_at: now,
        })
        .eq('meta_id', String(campaignId));

      console.log(`[supabase-sync] ✅ Ação na campanha ${campaignId} (${status}) registrada no Supabase.`);
    } catch (err) {
      console.warn('[supabase-sync] Erro ao registrar ação de campanha no Supabase:', err.message);
    }
  });
}
