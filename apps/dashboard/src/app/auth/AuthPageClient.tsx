"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, TrendingUp, BarChart3, Zap, ArrowRight, Loader2, Check, X, ChevronLeft } from "lucide-react";
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

type PasswordRule = { label: string; met: boolean };

function usePasswordRules(password: string): PasswordRule[] {
  return useMemo(
    () => [
      { label: "Mínimo 8 caracteres", met: password.length >= MIN_PASSWORD_LENGTH },
      { label: "Letra maiúscula (A–Z)", met: /[A-Z]/.test(password) },
      { label: "Letra minúscula (a–z)", met: /[a-z]/.test(password) },
      { label: "Caractere especial (!@#$...)", met: /[^A-Za-z0-9]/.test(password) },
    ],
    [password],
  );
}

const FEATURES = [
  { icon: TrendingUp, label: "ROAS em Tempo Real", desc: "Veja o retorno de cada centavo" },
  { icon: BarChart3, label: "Curva de Performance", desc: "Tendências diárias e semanais" },
  { icon: Zap, label: "Alertas Inteligentes", desc: "Notifique quando ROAS cair" },
];

type AuthPageClientProps = {
  nextParam: string | null;
  errorParam: string | null;
  messageParam?: string | null;
};

export default function AuthPageClient({ nextParam, errorParam, messageParam }: AuthPageClientProps) {
  const router = useRouter();
  const nextPath = sanitizeNextPath(nextParam);
  const queryError = mapAuthPageError(errorParam);
  const querySuccess = messageParam === "password_updated"
    ? "Senha redefinida com sucesso! Faça login para continuar."
    : null;

  const [tab, setTab] = useState<"login" | "signup">("login");
  const [view, setView] = useState<"auth" | "forgot">("auth");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
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
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  // Debug: verificar env vars ao carregar o componente
  useEffect(() => {
    console.log("[AUTH PAGE] Environment check on mount:", {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      urlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30),
    });

    // Tentar criar o client para testar
    try {
      const testClient = createClient();
      console.log("[AUTH PAGE] Supabase client test: SUCCESS");
    } catch (err) {
      console.error("[AUTH PAGE] Supabase client test: FAILED", err);
    }
  }, []);

  const passwordRules = usePasswordRules(password);
  const passwordValid = passwordRules.every((r) => r.met);

  function resetFeedback() {
    setError(null);
    setSuccessMessage(null);
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();
    setLoading(true);

    let supabase;
    try {
      supabase = createClient();
    } catch {
      setLoading(false);
      setError("Erro de configuração. Recarregue a página e tente novamente.");
      return;
    }

    const redirectUrl = new URL("/auth/reset-password", window.location.origin);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      forgotEmail.trim(),
      { redirectTo: redirectUrl.toString() },
    );

    setLoading(false);
    if (resetError) {
      setError("Não foi possível enviar o e-mail. Verifique o endereço e tente novamente.");
      return;
    }

    setSuccessMessage("E-mail enviado! Verifique sua caixa de entrada e clique no link para redefinir sua senha.");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    resetFeedback();
    setLoading(true);

    // Debug: verificar se as env vars estão disponíveis
    console.log("[AUTH] Environment check:", {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseUrlPrefix: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + "...",
    });

    let supabase;
    try {
      supabase = createClient();
      console.log("[AUTH] Supabase client created successfully");
    } catch (err) {
      console.error("[AUTH] Failed to create Supabase client:", err);
      setLoading(false);
      setError("Erro de configuração. Recarregue a página e tente novamente.");
      return;
    }

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

    // --- Signup validations ---
    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedPhone = phone.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFirst) {
      setLoading(false);
      setError("Informe seu nome.");
      return;
    }
    if (!trimmedLast) {
      setLoading(false);
      setError("Informe seu sobrenome.");
      return;
    }
    if (!trimmedPhone) {
      setLoading(false);
      setError("Informe seu telefone.");
      return;
    }
    if (!passwordValid) {
      setLoading(false);
      setPasswordTouched(true);
      setError("A senha não atende aos requisitos de segurança.");
      return;
    }
    if (confirmPassword !== password) {
      setLoading(false);
      setError(mapAuthPageError("password_mismatch"));
      return;
    }

    const fullName = `${trimmedFirst} ${trimmedLast}`;
    const signupRedirectUrl = new URL("/auth/callback", window.location.origin);
    signupRedirectUrl.searchParams.set("next", nextPath);

    console.log("[AUTH SIGNUP] Starting signup with:", {
      email: trimmedEmail,
      name: fullName,
      phone: trimmedPhone,
      redirectUrl: signupRedirectUrl.toString(),
    });

    const { data, error: signupError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        emailRedirectTo: signupRedirectUrl.toString(),
        data: {
          full_name: fullName,
          name: fullName,
          phone: trimmedPhone,
        },
      },
    });

    console.log("[AUTH SIGNUP] Response:", {
      hasData: !!data,
      hasUser: !!data?.user,
      hasSession: !!data?.session,
      userId: data?.user?.id,
      error: signupError?.message,
      errorName: signupError?.name,
      errorStatus: signupError?.status,
    });

    if (signupError) {
      console.error("[AUTH SIGNUP] Error:", signupError);
      setLoading(false);
      setError(mapAuthError(signupError.message));
      return;
    }

    // Verificar se o usuário foi criado mas não tem session (esperado com email confirmation)
    if (!data.user) {
      console.error("[AUTH SIGNUP] No user returned from signup");
      setLoading(false);
      setError("Erro ao criar usuário. Tente novamente.");
      return;
    }

    if (data.session) {
      console.log("[AUTH SIGNUP] Unexpected session received, signing out");
      await supabase.auth.signOut();
    }

    console.log("[AUTH SIGNUP] Success, user created:", data.user.id);
    setLoading(false);
    setSuccessMessage("Cadastro criado! Verifique seu e-mail e clique no link de confirmação para ativar sua conta.");
    setPassword("");
    setConfirmPassword("");
  }

  const visibleError = error ?? queryError;

  return (
    <div className="min-h-screen flex overflow-hidden">
      {/* Left panel */}
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

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 relative bg-slate-950 overflow-y-auto">
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
          className="w-full max-w-md z-10 py-8"
        >
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 font-bold text-xs">
              SM
            </div>
            <span className="text-white font-bold tracking-tight">START METRIC</span>
          </div>

          {/* Tela de Esqueci Senha */}
          <AnimatePresence mode="wait">
            {view === "forgot" && (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <button
                  type="button"
                  onClick={() => { resetFeedback(); setView("auth"); }}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-8"
                >
                  <ChevronLeft size={14} />
                  Voltar para o login
                </button>

                <h2 className="text-2xl font-bold text-white mb-1">Redefinir senha</h2>
                <p className="text-slate-500 text-sm mb-8">
                  Informe seu e-mail e enviaremos um link para você criar uma nova senha.
                </p>

                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="forgotEmail" className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                      E-mail
                    </label>
                    <input
                      id="forgotEmail"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="gestor@agencia.com.br"
                      required
                      autoComplete="email"
                      className="w-full px-4 py-3 rounded-xl glass text-slate-200 placeholder:text-slate-600 text-sm focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200"
                    />
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm"
                      >
                        {error}
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
                    disabled={loading || !!successMessage}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full py-3.5 rounded-xl bg-cyan-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 glow-primary-sm hover:bg-cyan-300 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : "Enviar link de redefinição"}
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {view === "auth" && (
            <div className="flex gap-1 p-1 glass rounded-xl mb-8 border-none">
              {(["login", "signup"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t);
                    resetFeedback();
                    setPasswordTouched(false);
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
          )}

          {view === "auth" && <AnimatePresence mode="wait">
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
                {tab === "login"
                  ? "Entre para ver seu painel de ROI."
                  : "Crie sua conta e confirme seu e-mail para ativar o acesso."}
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {tab === "signup" && (
                  <>
                    {/* Nome + Sobrenome */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label htmlFor="firstName" className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                          Nome
                        </label>
                        <input
                          id="firstName"
                          name="firstName"
                          type="text"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          placeholder="João"
                          required
                          autoComplete="given-name"
                          className="w-full px-4 py-3 rounded-xl glass text-slate-200 placeholder:text-slate-600 text-sm focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="lastName" className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                          Sobrenome
                        </label>
                        <input
                          id="lastName"
                          name="lastName"
                          type="text"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          placeholder="Silva"
                          required
                          autoComplete="family-name"
                          className="w-full px-4 py-3 rounded-xl glass text-slate-200 placeholder:text-slate-600 text-sm focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200"
                        />
                      </div>
                    </div>

                    {/* Telefone */}
                    <div className="space-y-2">
                      <label htmlFor="phone" className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                        Telefone
                      </label>
                      <input
                        id="phone"
                        name="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="(11) 99999-9999"
                        required
                        autoComplete="tel"
                        className="w-full px-4 py-3 rounded-xl glass text-slate-200 placeholder:text-slate-600 text-sm focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200"
                      />
                    </div>
                  </>
                )}

                {/* E-mail */}
                <div className="space-y-2">
                  <label htmlFor="email" className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    E-mail
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="gestor@agencia.com.br"
                    required
                    autoComplete="email"
                    className="w-full px-4 py-3 rounded-xl glass text-slate-200 placeholder:text-slate-600 text-sm focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30 transition-all duration-200"
                  />
                </div>

                {/* Senha */}
                <div className="space-y-2">
                  <label htmlFor="password" className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPwd ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => tab === "signup" && setPasswordTouched(true)}
                      placeholder="••••••••"
                      required
                      autoComplete={tab === "signup" ? "new-password" : "current-password"}
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

                  {/* Requisitos de senha (só no signup) */}
                  {tab === "signup" && (passwordTouched || password.length > 0) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="grid grid-cols-2 gap-1.5 pt-1"
                    >
                      {passwordRules.map((rule) => (
                        <div key={rule.label} className="flex items-center gap-1.5">
                          {rule.met ? (
                            <Check size={11} className="text-emerald-400 shrink-0" />
                          ) : (
                            <X size={11} className="text-slate-600 shrink-0" />
                          )}
                          <span
                            className={`text-[10px] transition-colors ${
                              rule.met ? "text-emerald-400" : "text-slate-600"
                            }`}
                          >
                            {rule.label}
                          </span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </div>

                {/* Confirmar senha */}
                {tab === "signup" && (
                  <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                      Confirmar senha
                    </label>
                    <div className="relative">
                      <input
                        id="confirmPassword"
                        name="confirmPassword"
                        type={showConfirmPwd ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        autoComplete="new-password"
                        className={`w-full px-4 py-3 pr-12 rounded-xl glass text-slate-200 placeholder:text-slate-600 text-sm focus:outline-none transition-all duration-200 ${
                          confirmPassword && confirmPassword !== password
                            ? "focus:border-red-400/50 focus:ring-1 focus:ring-red-400/30"
                            : "focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/30"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {confirmPassword && confirmPassword !== password && (
                      <p className="text-[11px] text-red-400">As senhas não conferem.</p>
                    )}
                  </div>
                )}

                {tab === "login" && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => { resetFeedback(); setForgotEmail(email); setView("forgot"); }}
                      className="text-xs text-cyan-400/70 hover:text-cyan-400 transition-colors"
                    >
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
                  {(successMessage ?? querySuccess) && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-400 text-sm"
                    >
                      {successMessage ?? querySuccess}
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
          </AnimatePresence>}
        </motion.div>
      </div>
    </div>
  );
}
