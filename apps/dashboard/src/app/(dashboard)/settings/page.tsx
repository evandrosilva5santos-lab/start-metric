import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ComingSoonBadge } from "@/components/ui/ComingSoonBadge";
import {
  Database,
  MessageSquare,
  Sparkles,
  CreditCard,
  ShieldCheck,
  Globe,
  Radio,
} from "lucide-react";

export const metadata = {
  title: "Integrações | Start Metric",
  description: "Gerencie integrações e configurações da sua conta.",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth");

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-300">
        <div>
          <p className="text-[11px] text-cyan-400/70 uppercase tracking-[0.2em] font-semibold mb-1">
            Configurações & Ecossistema
          </p>
          <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none">
            Integrações & Módulos
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Conecte canais de mídia, gateways de checkout e automações avançadas de tráfego.
          </p>
        </div>

        {/* Integrações Ativas */}
        <div className="space-y-3">
          <h2 className="text-xs uppercase font-bold tracking-wider text-slate-400 flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            Canais Ativos & Operacionais
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href="/settings/meta"
              className="glass rounded-2xl p-5 hover:border-cyan-400/30 transition-all duration-200 group relative overflow-hidden"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                    </svg>
                  </div>
                  <div>
                    <div className="font-semibold text-white group-hover:text-cyan-300 transition-colors">
                      Meta Ads (Graph API v21+)
                    </div>
                    <span className="text-[11px] text-emerald-400 font-medium">OAuth Conectado</span>
                  </div>
                </div>
                <ComingSoonBadge variant="new" label="OAuth v21" />
              </div>
              <p className="text-xs text-slate-400">
                Sincronização de contas de anúncio, insights de ROAS, CPA e pausamento de campanhas.
              </p>
            </Link>

            <div className="glass rounded-2xl p-5 border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <div className="font-semibold text-white">WhatsApp & Evolution API</div>
                    <span className="text-[11px] text-emerald-400 font-medium">Instâncias Ativas</span>
                  </div>
                </div>
                <ComingSoonBadge variant="pro" label="Pro" />
              </div>
              <p className="text-xs text-slate-400">
                Disparo de alertas, QR Code dinâmico e relatórios diários matinais no WhatsApp.
              </p>
            </div>
          </div>
        </div>

        {/* Módulos do Roadmap & Futuras Atualizações */}
        <div className="space-y-3 pt-4">
          <h2 className="text-xs uppercase font-bold tracking-wider text-slate-400 flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            Roadmap & Próximas Atualizações
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Meta CAPI UI */}
            <div className="glass rounded-2xl p-5 border-white/5 opacity-85 hover:opacity-100 transition-opacity">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                    <Database className="w-4 h-4 text-purple-400" />
                  </div>
                  <span className="font-semibold text-white">Meta Conversions API (CAPI)</span>
                </div>
                <ComingSoonBadge variant="beta" label="Backend Pronto" />
              </div>
              <p className="text-xs text-slate-400">
                Disparo server-side de conversões com SHA-256 e matching avançado de fbc/fbp.
              </p>
            </div>

            {/* Stripe / Shopify */}
            <div className="glass rounded-2xl p-5 border-white/5 opacity-75">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <CreditCard className="w-4 h-4 text-emerald-400" />
                  </div>
                  <span className="font-semibold text-white">Stripe / Shopify / Hotmart</span>
                </div>
                <ComingSoonBadge variant="roadmap" label="Fase 2" />
              </div>
              <p className="text-xs text-slate-400">
                Webhooks de vendas para cálculo automático de lucro líquido e conciliação de caixa.
              </p>
            </div>

            {/* Google Ads & TikTok */}
            <div className="glass rounded-2xl p-5 border-white/5 opacity-75">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                    <Globe className="w-4 h-4 text-amber-400" />
                  </div>
                  <span className="font-semibold text-white">Google Ads & TikTok Ads</span>
                </div>
                <ComingSoonBadge variant="soon" label="Em breve" />
              </div>
              <p className="text-xs text-slate-400">
                Consolidação de métricas cross-network e atribuição unificada de campanhas.
              </p>
            </div>

            {/* Proxy & Anti-ban WhatsApp */}
            <div className="glass rounded-2xl p-5 border-white/5 opacity-75">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  </div>
                  <span className="font-semibold text-white">Proxy Manager Anti-Ban</span>
                </div>
                <ComingSoonBadge variant="roadmap" label="Configuração Pro" />
              </div>
              <p className="text-xs text-slate-400">
                Roteamento de instâncias WhatsApp via proxies dedicados HTTP/SOCKS5.
              </p>
            </div>
          </div>
        </div>
      </div>
  );
}
