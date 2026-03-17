"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Lock, ShieldCheck, AlertTriangle, Eye, EyeOff, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type AdminAuthClientProps = {
  nextParam: string | null;
  errorParam: string | null;
};

function sanitizeAdminNextPath(next: string | null): string {
  if (!next) return "/admin";
  if (!next.startsWith("/admin") || next.startsWith("//") || next.startsWith("/admin/auth")) {
    return "/admin";
  }
  return next;
}

function mapError(codeOrMessage: string | null): string | null {
  if (!codeOrMessage) return null;
  const normalized = codeOrMessage.toLowerCase();

  if (normalized.includes("invalid login credentials")) {
    return "Credenciais inválidas para o backoffice.";
  }
  if (normalized.includes("email not confirmed")) {
    return "Confirme seu e-mail antes de acessar o backoffice.";
  }
  if (normalized.includes("not admin")) {
    return "Sua conta não pertence ao time administrativo.";
  }
  if (normalized === "access_denied") {
    return "Acesso administrativo negado para esta conta.";
  }

  return "Não foi possível autenticar no backoffice agora.";
}

export default function AdminAuthClient({ nextParam, errorParam }: AdminAuthClientProps) {
  const router = useRouter();
  const nextPath = useMemo(() => sanitizeAdminNextPath(nextParam), [nextParam]);
  const queryError = useMemo(() => mapError(errorParam), [errorParam]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    let supabase;
    try {
      supabase = createClient();
    } catch {
      setSubmitting(false);
      setError("Configuração inválida do ambiente. Tente recarregar a página.");
      return;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setSubmitting(false);
      setError(mapError(authError.message));
      return;
    }

    const accessCheck = await fetch("/api/admin/access", {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
    });

    if (!accessCheck.ok) {
      await supabase.auth.signOut();
      setSubmitting(false);

      if (accessCheck.status === 403) {
        setError("Sua conta autenticou, mas não possui permissão de admin.");
        return;
      }

      setError("Falha ao validar permissão administrativa. Tente novamente.");
      return;
    }

    router.replace(nextPath);
  }

  const visibleError = error ?? queryError;

  return (
    <div className="relative min-h-[calc(100vh-72px)] overflow-hidden bg-[#0b0f17]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-28 -left-20 h-72 w-72 rounded-full bg-orange-500/25 blur-3xl" />
        <div className="absolute top-1/2 -right-20 h-80 w-80 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-red-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-72px)] w-full max-w-7xl grid-cols-1 gap-10 px-6 py-10 lg:grid-cols-2 lg:gap-16 lg:px-10">
        <section className="flex flex-col justify-between rounded-3xl border border-orange-400/20 bg-gradient-to-br from-[#1a1410] via-[#14120f] to-[#100f0d] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-orange-300/30 bg-orange-300/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-orange-200">
              <ShieldCheck size={14} />
              Backoffice Seguro
            </div>

            <div>
              <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl">
                Painel
                <br />
                <span className="text-orange-300">Administrativo</span>
              </h1>
              <p className="mt-4 max-w-lg text-sm leading-relaxed text-slate-300">
                Ambiente isolado para operação interna, gestão de usuários, análise de incidentes e auditoria técnica.
                Não compartilha fluxo de autenticação com o portal de clientes.
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-slate-400">Política de acesso</p>
              <p className="mt-2 text-sm text-slate-200">
                Apenas e-mails presentes na allowlist de administração entram neste ambiente.
              </p>
            </div>

            <Link
              href="/auth"
              className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-orange-200 transition hover:text-orange-100"
            >
              Ir para login de cliente
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        <section className="flex items-center">
          <form
            onSubmit={handleSubmit}
            className="w-full rounded-3xl border border-white/10 bg-[#0f1420]/90 p-7 shadow-[0_25px_80px_rgba(0,0,0,0.4)] sm:p-9"
          >
            <div className="mb-7">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-orange-300">Admin Sign-In</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-white">Acesso Restrito</h2>
            </div>

            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">E-mail admin</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@startinc.com.br"
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-orange-300/40"
                  required
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Senha</span>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 pr-11 text-sm text-white outline-none transition focus:border-orange-300/40"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
            </div>

            {visibleError && (
              <div className="mt-5 flex items-start gap-2 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-3 text-sm text-red-100">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{visibleError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-orange-300/50 bg-gradient-to-r from-orange-500/80 to-amber-500/80 px-4 py-3 text-sm font-black uppercase tracking-[0.16em] text-black transition hover:from-orange-400 hover:to-amber-400 disabled:opacity-60"
            >
              <Lock size={16} />
              {submitting ? "Validando acesso..." : "Entrar no backoffice"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
