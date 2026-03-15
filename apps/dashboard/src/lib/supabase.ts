import { createBrowserClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Client para componentes de cliente (Next.js App Router) - usa @supabase/ssr
export const createClient = () =>
  createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);

// Client padrão para scripts ou chamadas diretas
export const supabase = createSupabaseClient<Database>(
  supabaseUrl,
  supabaseAnonKey,
);
