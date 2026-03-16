"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Loader2, Check, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;

function usePasswordRules(password: string) {
  return [
    { label: "Mínimo 8 caracteres", met: password.length >= MIN_PASSWORD_LENGTH },
    { label: "Letra maiúscula (A–Z)", met: /[A-Z]/.test(password) },
    { label: "Letra minúscula (a–z)", met: /[a-z]/.test(password) },
    { label: "Caractere especial (!@#$...)", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [passwordTouched, setPasswordTouched] = useState(false);

  const passwordRules = usePasswordRules(password);
  const passwordValid = passwordRules.every((r) => r.met);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!passwordValid) {
      setPasswordTouched(true);
      setError("A senha não atende aos requisitos de segurança.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não conferem.");
      return;
    }

    setLoading(true);
    let supabase;
    try {
      supabase = createClient();
    } catch {
      setLoading(false);
      setError("Erro de configuração. Recarregue a página e tente novamente.");
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError) {
      setError("Não foi possível redefinir a senha. O link pode ter expirado. Solicite um novo.");
      return;
    }

    router.replace("/auth?message=password_updated");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-8">
      <div
        className="absolute inset-0 opacity-30"
        style={{ backgroundImage: "radial-gradient(circle at 50% 30%, rgba(34,211,238,0.08) 0%, transparent 60%)" }}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md z-10"
      >
        <div className="flex items-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-lg bg-cyan-400/10 border border-cyan-400/30 flex items-center justify-center text-cyan-400 font-bold text-xs">
            SM
          </div>
          <span className="text-white font-bold tracking-tight">START METRIC</span>
        </div>

        <h2 className="text-2xl font-bold text-white mb-1">Nova senha</h2>
        <p className="text-slate-500 text-sm mb-8">Escolha uma senha forte para proteger sua conta.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Nova senha
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onBlur={() => setPasswordTouched(true)}
                placeholder="••••••••"
                required
                autoComplete="new-password"
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

            {(passwordTouched || password.length > 0) && (
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
                    <span className={`text-[10px] transition-colors ${rule.met ? "text-emerald-400" : "text-slate-600"}`}>
                      {rule.label}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
              Confirmar nova senha
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
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

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full py-3.5 rounded-xl bg-cyan-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 glow-primary-sm hover:bg-cyan-300 transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Salvar nova senha"}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}
