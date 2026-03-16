import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./types";

type SupabaseEnvName = "NEXT_PUBLIC_SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_ANON_KEY";

function requireEnv(name: SupabaseEnvName): string {
  const fallbackName =
    name === "NEXT_PUBLIC_SUPABASE_URL" ? "SUPABASE_URL" : "SUPABASE_ANON_KEY";
  const value = process.env[name] ?? process.env[fallbackName];
  if (!value) {
    throw new Error(
      `[supabase/client] Missing required environment variable: ${name} (fallback: ${fallbackName}). ` +
        "Configure it in your deployment provider and local .env file, then redeploy.",
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
