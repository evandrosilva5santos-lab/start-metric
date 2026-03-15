/**
 * Cliente Supabase com permissões elevadas (service role)
 * ATENÇÃO: Use apenas no servidor. Nunca expor no cliente.
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types.js';

type SupabaseEnvName = 'SUPABASE_URL' | 'SUPABASE_SERVICE_ROLE_KEY';

function requireEnv(name: SupabaseEnvName): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[supabase/admin] Missing required environment variable: ${name}. ` +
        'Configure it in your deployment provider and local .env file.',
    );
  }
  return value;
}

/**
 * Cria um cliente Supabase com permissões de serviço (service role).
 * Ignora RLS e tem acesso total ao banco.
 *
 * ⚠️ ATENÇÃO: Use apenas no lado do servidor (Server Components, API Routes, etc.)
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    requireEnv('SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
