"use client";

import { useState, useMemo } from "react";
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

    let supabase;
    try {
      supabase = createClient();
    } catch {
      setLoading(false);
      setError("Erro de configuração. Recarregue a página e tente novamente.");
      return;
    }

    if (tab === "login") {
      // 1. Tentar autenticação com PAINEL_SENHA / DASHBOARD_PASSWORD
      if (password) {
        try {
          const authRes = await fetch("/api/auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ password }),
          });
          const authData = await authRes.json().catch(() => ({}));
          if (authRes.ok && authData?.ok) {
            setLoading(false);
            setRedirecting(true);
            router.replace(nextPath);
            return;
          }
        } catch {
          // Prossegue para Supabase se falhar
        }
      }

      // 2. Se há e-mail informado, tenta autenticar via Supabase
      if (email.trim()) {
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

      setLoading(false);
      setError("Senha incorreta. Verifique e tente novamente.");
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

    if (signupError) {
      setLoading(false);
      setError(mapAuthError(signupError.message));
      return;
    }

    // Verificar se o usuário foi criado mas não tem session (esperado com email confirmation)
    if (!data.user) {
      setLoading(false);
      setError("Erro ao criar usuário. Tente novamente.");
      return;
    }

    if (data.session) {
      await supabase.auth.signOut();
    }
    setLoading(false);
    setSuccessMessage("Cadastro criado! Verifique seu e-mail e clique no link de confirmação para ativar sua conta.");
    setPassword("");
    setConfirmPassword("");
  }

  const visibleError = error ?? queryError;

  return (
    <div className="flex min-h-screen bg-surface">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-14 text-sidebar-fg lg:flex lg:w-[52%]">

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 z-10"
        >
          <span aria-hidden="true" className="size-7 rounded-control bg-primary" />
          <span className="font-display text-[20px] font-bold text-sidebar-strong">Start Metric</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="z-10 space-y-8"
        >
          <div>
            <p className="mb-3 font-display text-[13px] font-medium text-sky">
              Para Gestores de Tráfego
            </p>
            <h1 className="font-display text-[30px] font-semibold leading-[1.15] text-sidebar-strong">
              ROI é o que
              <br />
              <span className="text-sky">importa.</span>
            </h1>
            <p className="mt-4 max-w-sm text-[16px] leading-relaxed text-sidebar-fg">
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
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-sidebar-active">
                  <Icon size={16} className="text-sky" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-[14px] font-medium text-sidebar-strong">{label}</p>
                  <p className="mt-0.5 text-[13px] text-sidebar-muted">{desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="z-10 rounded-panel border border-sidebar-active bg-sidebar-active/50 p-5"
        >
          <p className="mb-1 text-[13px] text-sidebar-muted">Como funciona</p>
          <p className="font-display text-[20px] font-semibold text-sidebar-strong">Lucro real por campanha</p>
          <p className="mt-1 text-[13px] text-sidebar-muted">O gasto da Meta cruzado com as suas vendas, sem número estimado.</p>
        </motion.div>
      </div>

      <div className="relative flex flex-1 items-start justify-center overflow-y-auto bg-surface px-4 py-6 md:items-center md:p-8">

        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md z-10 py-8"
        >
          <div className="flex items-center gap-2 mb-10 lg:hidden">
            <span aria-hidden="true" className="size-[22px] rounded-control bg-primary" />
            <span className="font-display text-[16px] font-bold text-fg">Start Metric</span>
          </div>

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
                  className="mb-8 flex min-h-11 items-center gap-1.5 text-[13px] text-fg-muted transition-colors hover:text-fg"
                >
                  <ChevronLeft size={14} />
                  Voltar para o login
                </button>

                <h2 className="mb-1 font-display text-[24px] font-semibold leading-[1.2] text-fg">Redefinir senha</h2>
                <p className="mb-8 text-[14px] text-fg-muted">
                  Informe seu e-mail e enviaremos um link para você criar uma nova senha.
                </p>

                <form onSubmit={handleForgotPassword} className="space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="forgotEmail" className="text-[13px] font-medium text-fg">
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
                      className="h-11 w-full rounded-control border border-border-strong bg-surface px-3 text-[16px] text-fg placeholder:text-faint transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 md:text-[14px]"
                    />
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="rounded-md border-l-[3px] border-danger bg-danger-tint px-4 py-3 text-[14px] text-danger"
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
                        className="rounded-md border-l-[3px] border-success bg-success-tint px-4 py-3 text-[14px] text-success"
                      >
                        {successMessage}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    type="submit"
                    disabled={loading || !!successMessage}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-button bg-primary text-[14px] font-medium text-primary-fg transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : "Enviar link de redefinição"}
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {view === "auth" && (
            <div role="group" aria-label="Acesso" className="mb-8 flex gap-1 rounded-button border border-border bg-subtle p-1">
              {(["login", "signup"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTab(t);
                    resetFeedback();
                    setPasswordTouched(false);
                  }}
                  aria-pressed={tab === t}
                  type="button"
                  className={`min-h-11 flex-1 rounded-control text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-9 ${
                    tab === t
                      ? "bg-surface text-fg shadow-card ring-1 ring-border"
                      : "text-fg-muted hover:text-fg"
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
              <h2 className="mb-1 font-display text-[24px] font-semibold leading-[1.2] text-fg">
                {tab === "login" ? "Bem-vindo de volta" : "Comece agora"}
              </h2>
              <p className="mb-8 text-[14px] text-fg-muted">
                {tab === "login"
                  ? "Entre para ver seu painel de ROI."
                  : "Crie sua conta e confirme seu e-mail para ativar o acesso."}
              </p>

              <form onSubmit={handleSubmit} className="space-y-5">
                {tab === "signup" && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <label htmlFor="firstName" className="text-[13px] font-medium text-fg">
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
                          className="h-11 w-full rounded-control border border-border-strong bg-surface px-3 text-[16px] text-fg placeholder:text-faint transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 md:text-[14px]"
                        />
                      </div>
                      <div className="space-y-2">
                        <label htmlFor="lastName" className="text-[13px] font-medium text-fg">
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
                          className="h-11 w-full rounded-control border border-border-strong bg-surface px-3 text-[16px] text-fg placeholder:text-faint transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 md:text-[14px]"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="phone" className="text-[13px] font-medium text-fg">
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
                        className="h-11 w-full rounded-control border border-border-strong bg-surface px-3 text-[16px] text-fg placeholder:text-faint transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 md:text-[14px]"
                      />
                    </div>
                  </>
                )}

                <div className="space-y-2">
                  <label htmlFor="email" className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[13px] font-medium text-fg">
                    <span>E-mail</span>
                    {tab === "login" && (
                      <span className="text-[12px] font-normal text-fg-muted">
                        (opcional se entrar com a senha do painel)
                      </span>
                    )}
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="gestor@agencia.com.br"
                    required={tab === "signup"}
                    autoComplete="email"
                    className="h-11 w-full rounded-control border border-border-strong bg-surface px-3 text-[16px] text-fg placeholder:text-faint transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 md:text-[14px]"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-[13px] font-medium text-fg">
                    {tab === "login" ? "Senha do Painel ou da Conta" : "Senha"}
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      name="password"
                      type={showPwd ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onBlur={() => tab === "signup" && setPasswordTouched(true)}
                      placeholder={tab === "login" ? "Digite a senha do painel" : "••••••••"}
                      required
                      autoComplete={tab === "signup" ? "new-password" : "current-password"}
                      className="h-11 w-full rounded-control border border-border-strong bg-surface px-3 pr-12 text-[16px] text-fg placeholder:text-faint transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring/30 md:text-[14px]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(!showPwd)}
                      aria-label={showPwd ? "Ocultar senha" : "Ver senha"}
                      className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center text-fg-muted transition-colors hover:text-fg"
                    >
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {tab === "signup" && (passwordTouched || password.length > 0) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="grid grid-cols-2 gap-1.5 pt-1"
                    >
                      {passwordRules.map((rule) => (
                        <div key={rule.label} className="flex items-center gap-1.5">
                          {rule.met ? (
                            <Check size={11} className="text-success shrink-0" />
                          ) : (
                            <X size={11} className="text-fg-muted shrink-0" />
                          )}
                          <span
                            className={`text-[12px] transition-colors ${
                              rule.met ? "text-success" : "text-fg-muted"
                            }`}
                          >
                            {rule.label}
                          </span>
                        </div>
                      ))}
                    </motion.div>
                  )}
                </div>

                {tab === "signup" && (
                  <div className="space-y-2">
                    <label htmlFor="confirmPassword" className="text-[13px] font-medium text-fg">
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
                        className={`h-11 w-full rounded-control border border-border-strong bg-surface px-3 pr-12 text-[16px] text-fg placeholder:text-faint transition-colors focus:outline-none md:text-[14px] ${
                          confirmPassword && confirmPassword !== password
                            ? "focus:border-danger focus:ring-2 focus:ring-danger/30"
                            : "focus:border-primary focus:ring-2 focus:ring-ring/30"
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                        aria-label={showConfirmPwd ? "Ocultar confirmação de senha" : "Ver confirmação de senha"}
                        className="absolute right-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center text-fg-muted transition-colors hover:text-fg"
                      >
                        {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {confirmPassword && confirmPassword !== password && (
                      <p className="text-[12px] text-danger">As senhas não conferem.</p>
                    )}
                  </div>
                )}

                {tab === "login" && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => { resetFeedback(); setForgotEmail(email); setView("forgot"); }}
                      className="min-h-11 text-[13px] font-medium text-primary hover:underline lg:min-h-0"
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
                      className="rounded-md border-l-[3px] border-danger bg-danger-tint px-4 py-3 text-[14px] text-danger"
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
                      className="rounded-md border-l-[3px] border-success bg-success-tint px-4 py-3 text-[14px] text-success"
                    >
                      {successMessage ?? querySuccess}
                    </motion.div>
                  )}
                </AnimatePresence>

                <motion.button
                  type="submit"
                  disabled={loading || redirecting}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-button bg-primary text-[14px] font-medium text-primary-fg transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
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

              <p className="mt-8 text-center text-[12px] text-fg-muted">
                Ao continuar, você concorda com os{" "}
                <button className="inline-flex min-h-11 items-center text-fg-muted underline transition-colors hover:text-fg lg:min-h-0">
                  Termos de Uso
                </button>{" "}
                e a{" "}
                <button className="inline-flex min-h-11 items-center text-fg-muted underline transition-colors hover:text-fg lg:min-h-0">
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
