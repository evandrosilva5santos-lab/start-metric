import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Ajustes | Start Metric",
  description: "Gerencie integracoes e configuracoes da sua conta.",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
          ← Voltar ao Dashboard
        </Link>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Ajustes</h1>
          <p className="text-gray-400 text-sm">Integrações e configuracoes basicas.</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Link
            href="/settings/meta"
            className="bg-gray-900 border border-gray-800 rounded-2xl p-5 hover:bg-gray-900/70 transition-colors"
          >
            <div className="font-semibold">Meta Ads</div>
            <div className="text-sm text-gray-400 mt-1">
              Conectar conta, sincronizar campanhas e metricas.
            </div>
          </Link>

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 opacity-60">
            <div className="font-semibold">Stripe / Vendas (em breve)</div>
            <div className="text-sm text-gray-400 mt-1">
              Integre vendas para calcular lucro e atribuicao.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

