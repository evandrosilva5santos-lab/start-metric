"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";

export default function SharedAuthPage({
  params,
}: {
  params: Promise<{ token: string }> | { token: string };
}) {
  const resolvedParams = "then" in params ? use(params) : params;
  const token = resolvedParams.token;
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Validar token com senha
      const response = await fetch("/api/shared/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: password,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Falha na validação");
      }

      // Sucesso - redirecionar para dashboard
      router.push(`/shared/dashboard/${token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-subtle to-subtle p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div className="bg-subtle rounded-lg shadow-2xl border border-border p-8">
          {/* Ícone */}
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-primary-tint rounded-lg">
              <Lock className="w-6 h-6 text-primary" />
            </div>
          </div>

          {/* Título */}
          <h1 className="text-2xl font-bold text-fg text-center mb-2">
            Acesso Protegido
          </h1>
          <p className="text-fg-muted text-center mb-6">
            Digite a senha para acessar o dashboard compartilhado
          </p>

          {/* Erro */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-3 bg-danger-tint border border-danger/40 rounded-lg"
            >
              <p className="text-danger text-sm">{error}</p>
            </motion.div>
          )}

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-fg mb-2">
                Senha
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha"
                disabled={loading}
                className="w-full px-4 py-2 bg-border-strong border border-border-strong rounded-lg text-fg placeholder-faint focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-2 px-4 bg-primary hover:bg-primary-hover disabled:bg-primary-tint disabled:cursor-not-allowed text-primary-fg font-medium rounded-lg transition-colors duration-200"
            >
              {loading ? "Validando..." : "Acessar"}
            </button>
          </form>

          {/* Footer */}
          <p className="text-fg-muted text-xs text-center mt-6">
            Este link foi compartilhado de forma segura
          </p>
        </div>
      </motion.div>
    </div>
  );
}
