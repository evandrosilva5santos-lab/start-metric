import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

type SupabaseEnvName = "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY";

function requireEnv(name: SupabaseEnvName): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[supabase/client] Missing required environment variable: ${name}. ` +
        "Configure it in your deployment provider and local .env file.",
    );
  }
  return value;
}

export function createClient() {
  return createBrowserClient<Database>(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  );
}
