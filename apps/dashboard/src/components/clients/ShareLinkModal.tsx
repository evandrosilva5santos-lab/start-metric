"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, Check, Loader2, AlertCircle } from "lucide-react";
import { z } from "zod";

interface ShareLinkModalProps {
  clientId: string;
  clientName: string;
  isOpen: boolean;
  onClose: () => void;
}

const shareLinkFormSchema = z.object({
  expires_in_days: z.number().min(1).max(365).default(30),
  protected: z.boolean().default(false),
  password: z.string().optional().or(z.literal("")),
  max_accesses_enabled: z.boolean().default(false),
  max_accesses: z.number().int().positive().optional().nullable(),
});

type ShareLinkForm = z.infer<typeof shareLinkFormSchema>;

export default function ShareLinkModal({
  clientId,
  clientName,
  isOpen,
  onClose,
}: ShareLinkModalProps) {
  const [form, setForm] = useState<ShareLinkForm>({
    expires_in_days: 30,
    protected: false,
    password: "",
    max_accesses_enabled: false,
    max_accesses: null,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerateLink = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/shared/generate-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          access_type: "dashboard",
          expires_in_days: form.expires_in_days,
          password: form.protected ? form.password : undefined,
          max_accesses: form.max_accesses_enabled ? form.max_accesses : null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao gerar link");
      }

      const data = await response.json();
      setGeneratedLink(data.data.url);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReset = () => {
    setSuccess(false);
    setGeneratedLink(null);
    setForm({
      expires_in_days: 30,
      protected: false,
      password: "",
      max_accesses_enabled: false,
      max_accesses: null,
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="bg-slate-800 rounded-lg shadow-2xl border border-slate-700 max-w-md w-full max-h-[90vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-slate-700">
                <h2 className="text-xl font-bold text-white">
                  Compartilhar Dashboard
                </h2>
                <button
                  onClick={onClose}
                  className="p-1 hover:bg-slate-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6">
                {!success ? (
                  <div className="space-y-5">
                    {/* Cliente */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Cliente
                      </label>
                      <input
                        type="text"
                        value={clientName}
                        disabled
                        className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white text-sm disabled:opacity-50"
                      />
                    </div>

                    {/* Expiração */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        Expira em (dias)
                      </label>
                      <select
                        value={form.expires_in_days}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            expires_in_days: parseInt(e.target.value),
                          })
                        }
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value={7}>7 dias</option>
                        <option value={14}>14 dias</option>
                        <option value={30}>30 dias</option>
                        <option value={90}>90 dias</option>
                        <option value={365}>1 ano</option>
                      </select>
                    </div>

                    {/* Proteção por Senha */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.protected}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              protected: e.target.checked,
                              password: "",
                            })
                          }
                          className="w-4 h-4 rounded border-slate-600 bg-slate-700 checked:bg-blue-600"
                        />
                        <span className="text-sm font-medium text-slate-300">
                          Proteger com senha
                        </span>
                      </label>

                      {form.protected && (
                        <input
                          type="password"
                          placeholder="Digite a senha"
                          value={form.password}
                          onChange={(e) =>
                            setForm({ ...form, password: e.target.value })
                          }
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                      )}
                    </div>

                    {/* Limite de Acessos */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={form.max_accesses_enabled}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              max_accesses_enabled: e.target.checked,
                              max_accesses: e.target.checked ? 1 : null,
                            })
                          }
                          className="w-4 h-4 rounded border-slate-600 bg-slate-700 checked:bg-blue-600"
                        />
                        <span className="text-sm font-medium text-slate-300">
                          Limitar acessos
                        </span>
                      </label>

                      {form.max_accesses_enabled && (
                        <input
                          type="number"
                          min="1"
                          placeholder="Número máximo de acessos"
                          value={form.max_accesses || ""}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              max_accesses: e.target.value ? parseInt(e.target.value) : null,
                            })
                          }
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                      )}
                    </div>

                    {/* Erro */}
                    {error && (
                      <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                        <p className="text-red-400 text-sm flex items-center gap-2">
                          <AlertCircle className="w-4 h-4" />
                          {error}
                        </p>
                      </div>
                    )}

                    {/* Botão */}
                    <button
                      onClick={handleGenerateLink}
                      disabled={loading || (form.protected && !form.password)}
                      className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                          Gerando...
                        </>
                      ) : (
                        "Gerar Link"
                      )}
                    </button>
                  </div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 text-center"
                  >
                    {/* Sucesso */}
                    <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-lg">
                      <p className="text-green-400 font-medium text-sm">
                        ✓ Link gerado com sucesso!
                      </p>
                    </div>

                    {/* Link */}
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Compartilhe este link:
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={generatedLink || ""}
                          readOnly
                          className="flex-1 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
                        />
                        <button
                          onClick={handleCopyLink}
                          className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                        >
                          {copied ? (
                            <Check className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Informações */}
                    <div className="text-xs text-slate-400 space-y-1 text-left bg-slate-700/50 p-3 rounded">
                      <p>
                        <strong>Expira em:</strong> {form.expires_in_days} dias
                      </p>
                      {form.protected && <p><strong>Protegido:</strong> Sim (com senha)</p>}
                      {form.max_accesses_enabled && (
                        <p>
                          <strong>Limite:</strong> {form.max_accesses} acessos
                        </p>
                      )}
                    </div>

                    {/* Botões */}
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopyLink}
                        className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Copy className="w-4 h-4" />
                        {copied ? "Copiado!" : "Copiar Link"}
                      </button>
                      <button
                        onClick={handleReset}
                        className="flex-1 py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                      >
                        Novo Link
                      </button>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-700">
                <button
                  onClick={onClose}
                  className="w-full py-2 px-4 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
