"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, TrendingUp, BarChart3, Zap, ArrowRight, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;

function sanitizeNextPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/auth")) {
    return "/performance";
  }

  return next;
}

function mapAuthError(errorMessage: string) {
  const message = errorMessage.toLowerCase();

  if (message.includes("email not confirmed")) {
    return "Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada.";
  }

  if (message.includes("invalid login credentials")) {
    return "E-mail ou senha inválidos.";
  }

  if (message.includes("user already registered")) {
    return "Este e-mail já está cadastrado. Faça login para continuar.";
  }

  if (message.includes("password should be at least")) {
    return `A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`;
  }

  return "Não foi possível autenticar agora. Tente novamente em instantes.";
}

function mapAuthPageError(errorCode: string | null) {
  switch (errorCode) {
    case "missing_code":
      return "O link de confirmação está incompleto. Solicite um novo e-mail.";
    case "callback_failed":
      return "Não foi possível confirmar seu e-mail. Tente novamente.";
    case "profile_setup_failed":
      return "Seu acesso foi validado, mas o perfil inicial não foi configurado corretamente.";
    case "password_mismatch":
      return "A confirmação de senha não confere.";
    case "email_not_confirmed":
      return "Confirme seu e-mail antes de entrar no painel.";
    default:
      return null;
  }
}

const FEATURES = [
  { icon: TrendingUp, label: "ROAS em Tempo Real", desc: "Veja o retorno de cada centavo" },
  { icon: BarChart3, label: "Curva de Performance", desc: "Tendências diárias e semanais" },
  { icon: Zap, label: "Alertas Inteligentes", desc: "Notifique quando ROAS cair" },
];

type AuthPageClientProps = {
  nextParam: string | null;
  errorParam: string | null;
};

export default function AuthPageClient({ nextParam, errorParam }: AuthPageClientProps) {
  const router = useRouter();
  const nextPath = sanitizeNextPath(nextParam);
  const queryError = mapAuthPageError(errorParam);

  const [tab, setTab] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  function resetFeedback() {
    setError(null);
    setSuccessMessage(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();
    setLoading(true);
    const supabase = createClient();

    if (tab === "login") {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      setLoading(false);
      if (loginError) {
        setError(mapAuthError(loginError.message));
        return;
      }

      setRedirecting(true);
      router.replace(nextPath);
      return;
    }

    const trimmedName = name.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setLoading(false);
      setError("Informe seu nome para criar a conta.");
      return;
    }

    if (!trimmedPhone) {
      setLoading(false);
      setError("Informe seu telefone para criar a conta.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setLoading(false);
      setError(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
      return;
    }

    if (confirmPassword !== password) {
      setLoading(false);
      setError(mapAuthPageError("password_mismatch"));
      return;
    }

    const signupRedirectUrl = new URL("/auth/callback", window.location.origin);
    signupRedirectUrl.searchParams.set("next", nextPath);

    const { data, error: signupError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        emailRedirectTo: signupRedirectUrl.toString(),
        data: {
          name: trimmedName,
          phone: trimmedPhone,
        },
      },
    });

    if (signupError) {
      setLoading(false);
      setError(mapAuthError(signupError.message));
      return;
    }

    if (data.session) {
      await supabase.auth.signOut();
    }

    setLoading(false);
    setSuccessMessage("Cadastro criado. Verifique seu e-mail para confirmar o acesso.");
    setPassword("");
    setConfirmPassword("");
  }

  const visibleError = error ?? queryError;

  return (
    <div className="min-h-screen flex overflow-hidden">
      <div className="hidden lg:flex lg:w-[52%] relative flex-col justify-between p-14 overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div
          className="absolute top-[-120px] right-[-80px] w-[480px] h-[480px] rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #22d3ee 0%, #818cf8 60%, transparent 100%)" }}
        />
        <div
          className="absolute bottom-[-80px] left-[-40px] w-[320px] h-[320px] rounded-full opacity-15 blur-3xl"
          style={{ background: "radial-gradient(circle, #34d399 0%, transparent 100%)" }}
        />

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 z-10"
        >
          <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 font-bold text-sm tracking-widest">
            SM
          </div>
          <span className="text-white font-bold text-xl tracking-tight">START METRIC</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="z-10 space-y-8"
        >
          <div>
            <p className="text-cyan-400 text-sm font-semibold uppercase tracking-[0.2em] mb-3">
              Para Gestores de Tráfego
            </p>
            <h1 className="text-5xl font-extrabold text-white leading-[1.15]">
              ROI é o que
              <br />
              <span className="text-gradient-primary">importa.</span>
            </h1>
            <p className="text-slate-400 mt-4 text-lg leading-relaxed max-w-sm">
              Chega de planilha. Tenha inteligência de performance em tempo real para todas as suas contas de anúncios.
            </p>
          </div>

          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, label, desc }, i) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.1 }}
                className="flex items-start gap-4"
              >
                <div className="w-9 h-9 rounded-lg bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-cyan-400" />
                </div>
                <div>
                  <p className="text-slate-200 font-semibold text-sm">{label}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="glass border-cyan-500/10 rounded-2xl p-5 z-10"
        >
          <p className="text-slate-500 text-xs uppercase tracking-widest mb-2">Média dos usuários</p>
          <p className="text-3xl font-extrabold text-gradient-roi text-mono">4.7x ROAS</p>
          <p className="text-slate-500 text-xs mt-1">nos últimos 30 dias de dados</p>
        </motion.div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 relative bg-slate-950">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: "radial-gradient(circle at 70% 30%, rgba(34,211,238,0.08) 0%, transparent 60%)",
          }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md z-10"
        >
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 font-bold text-xs">
              SM
            </div>
            <span className="text-white font-bold tracking-tight">START METRIC</span>
          </div>

          <div className="flex gap-1 p-1 glass rounded-xl mb-8 border-none">
            {(["login", "signup"] as const).map((t) => (
              <button
                key={t}
                onClick={() => {
                  setTab(t);
                  resetFeedback();
                }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                  tab === t
                    ? "bg-cyan-400/10 text-cyan-400 border border-cyan-400/20"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {t === "login" ? "Entrar" : "Criar conta"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="text-2xl font-bold text-white mb-1">
                {tab === "login" ? "Bem-vindo de volta" : "Comece agora"}
              </h2>
              <p className="text-slate-500 text-sm mb-8">
                {tab === "login" ? "Entre para ver seu painel de ROI." : "Crie sua conta e confirme seu e-mail."}
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {tab === "signup" && (
                  <>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                        Nome
                      </label>
                      <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Seu nome completo"
                        required
                        className="w-full px-4 py-3 rounded-xl glass text-slate-200 placeholder:text-slate-600 text-sm focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                        Telefone
                      </label>
                      <input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        required
                        className="w-full px-4 py-3 rounded-xl glass text-slate-200 placeholder:text-slate-600 text-sm focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    E-mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="gestor@agencia.com.br"
                    required
                    className="w-full px-4 py-3 rounded-xl glass text-slate-200 placeholder:text-slate-600 text-sm focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPwd ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-4 py-3 pr-12 rounded-xl glass text-slate-200 placeholder:text-slate-600 text-sm focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {tab === "signup" && (
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                      Confirmar senha
                    </label>
                    <div className="relative">
                      <input
                        id="confirm-password"
                        type={showConfirmPwd ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        className="w-full px-4 py-3 pr-12 rounded-xl glass text-slate-200 placeholder:text-slate-600 text-sm focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}

                {tab === "login" && (
                  <div className="text-right">
                    <button type="button" className="text-xs text-cyan-400/70 hover:text-cyan-400 transition-colors">
                      Esqueci minha senha
                    </button>
                  </div>
                )}

                <AnimatePresence>
                  {visibleError && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm"
                    >
                      {visibleError}
                    </motion.div>
                  )}
                </AnimatePresence>

                <AnimatePresence>
                  {successMessage && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 text-sm"
                    >
                      {successMessage}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={loading || redirecting}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full py-3.5 rounded-xl bg-cyan-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 glow-primary-sm hover:bg-cyan-300 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : redirecting ? (
                    "✓ Redirecionando..."
                  ) : (
                    <>
                      {tab === "login" ? "Entrar no painel" : "Criar minha conta"}
                      <ArrowRight size={16} />
                    </>
                  )}
                </motion.button>
              </form>

              <p className="text-center text-xs text-slate-600 mt-8">
                Ao continuar, você concorda com os{" "}
                <button className="text-slate-400 hover:text-slate-200 underline transition-colors">
                  Termos de Uso
                </button>{" "}
                e a{" "}
                <button className="text-slate-400 hover:text-slate-200 underline transition-colors">
                  Política de Privacidade
                </button>
                .
              </p>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
