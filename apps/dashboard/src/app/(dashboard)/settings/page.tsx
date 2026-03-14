import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";


export const metadata = {
  title: "Integrações | Start Metric",
  description: "Gerencie integrações e configurações da sua conta.",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  return (
    <main className="flex-1 p-8 overflow-y-auto min-w-0">
        <div className="max-w-3xl mx-auto space-y-8">
          <div>
            <p className="text-[11px] text-cyan-400/70 uppercase tracking-[0.2em] font-semibold mb-1">
              Configurações
            </p>
            <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none">
              Integrações
            </h1>
            <p className="text-sm text-slate-500 mt-2">
              Conecte plataformas e gerencie configurações da conta.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Link
              href="/settings/meta"
              className="glass rounded-2xl p-5 hover:border-cyan-400/20 transition-all duration-200 group"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                  </svg>
                </div>
                <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
                  Meta Ads
                </div>
              </div>
              <p className="text-sm text-slate-500">
                Conectar conta, sincronizar campanhas e métricas.
              </p>
            </Link>

            <div className="glass rounded-2xl p-5 opacity-50 cursor-not-allowed">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <span className="text-emerald-400 text-xs font-bold">$</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-white">Stripe / Vendas</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-500 border border-slate-700/50 uppercase tracking-wider font-semibold">
                    Em breve
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-500">
                Integre vendas para calcular lucro e atribuição.
              </p>
            </div>
          </div>
        </div>
      </main>
  );
}
