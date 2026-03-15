/**
 * @start-metric/supabase
 * Cliente Supabase unificado (browser + server + admin)
 */

export { createClient as createBrowserClient } from './client.js';
export { createClient as createServerClient } from './server.js';
export { createAdminClient } from './admin.js';
export type { Database, Tables, TablesInsert, TablesUpdate } from './types.js';
