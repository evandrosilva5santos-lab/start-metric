// app/settings/meta/page.tsx
// Página "Conectar Conta Meta Ads" — Server Component com Client Components inline.
// Exibe contas conectadas, status e botões de ação.

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

import MetaAccountsClient from "./MetaAccountsClient";

export const metadata = {
  title: "Conectar Meta Ads | Start Metric",
  description: "Conecte sua conta Meta Ads para sincronizar campanhas e métricas.",
};

export default async function MetaSettingsPage({
  searchParams,
}: {
  searchParams?: { connected?: string; error?: string };
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/auth");

  const params = searchParams ?? {};

  // Busca contas conectadas (RLS: apenas da org do user)
  const { data: accounts } = await supabase
    .from("ad_accounts")
    .select("id, name, external_id, status, currency, connected_at, token_expires_at")
    .eq("platform", "meta")
    .order("connected_at", { ascending: false });

  return (
    <main className="flex-1 p-8 overflow-y-auto min-w-0">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-10">
            <p className="text-[11px] text-cyan-400/70 uppercase tracking-[0.2em] font-semibold mb-1">
              Integrações
            </p>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none">
                  Meta Ads
                </h1>
                <p className="text-slate-500 text-sm mt-1">
                  Conecte seu gerenciador de anúncios
                </p>
              </div>
            </div>
          </div>

          <MetaAccountsClient
            accounts={accounts ?? []}
            flashConnected={params.connected === "true"}
            flashError={params.error}
          />
        </div>
      </main>
  );
}
