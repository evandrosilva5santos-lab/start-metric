"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Check } from "lucide-react";
import { z } from "zod";

const clientSchema = z.object({
  name: z.string().min(2, "Nome muito curto"),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  logo_url: z.string().url("URL inválida").optional().or(z.literal("")),
  notes: z.string().max(1000).optional(),
});

type AdAccount = {
  id: string;
  name: string | null;
  external_id: string;
  platform: string;
  status: string;
};

type Client = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  logo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  client?: Client | null;
  onSaved: () => void;
};

export function ClientModal({ isOpen, onClose, client, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [fetchingAccounts, setFetchingAccounts] = useState(false);
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [notes, setNotes] = useState("");

  // Load accounts on mount
  useEffect(() => {
    if (isOpen) {
      fetchAccounts();
    }
  }, [isOpen]);

  // Populate form when editing
  useEffect(() => {
    if (client) {
      setName(client.name);
      setEmail(client.email || "");
      setPhone(client.phone || "");
      setWhatsapp(client.whatsapp || "");
      setLogoUrl(client.logo_url || "");
      setNotes(client.notes || "");
    } else {
      resetForm();
    }
  }, [client]);

  const fetchAccounts = async () => {
    setFetchingAccounts(true);
    try {
      const response = await fetch("/api/meta/accounts");
      const result = await response.json();

      if (response.ok && result.data) {
        setAccounts(result.data);
      }
    } catch (err) {
      console.error("Erro ao buscar contas:", err);
    } finally {
      setFetchingAccounts(false);
    }
  };

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setWhatsapp("");
    setLogoUrl("");
    setNotes("");
    setSelectedAccounts([]);
    setErrors({});
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    try {
      const data = {
        name,
        email,
        phone,
        whatsapp,
        logo_url: logoUrl,
        notes,
        account_ids: selectedAccounts,
      };

      const validationResult = clientSchema.safeParse(data);

      if (!validationResult.success) {
        const fieldErrors: Record<string, string> = {};
        validationResult.error.issues.forEach((issue) => {
          if (issue.path[0]) {
            fieldErrors[issue.path[0].toString()] = issue.message;
          }
        });
        setErrors(fieldErrors);
        return;
      }

      const url = client ? `/api/clients/${client.id}` : "/api/clients";
      const method = client ? "PATCH" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Erro ao salvar cliente");
      }

      onSaved();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erro ao salvar");
    } finally {
      setLoading(false);
    }
  };

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(accountId)
        ? prev.filter((id) => id !== accountId)
        : [...prev, accountId]
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
                <h2 className="text-lg font-bold text-white">
                  {client ? "Editar Cliente" : "Novo Cliente"}
                </h2>
                <button
                  onClick={handleClose}
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {/* Nome */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                    Nome *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nome do cliente"
                    className={`w-full px-4 py-3 rounded-xl bg-slate-900 border text-slate-200 focus:outline-none focus:ring-1 transition-colors ${
                      errors.name
                        ? "border-red-400/50 focus:border-red-400 focus:ring-red-400/30"
                        : "border-slate-700 focus:border-cyan-400/50 focus:ring-cyan-400/30"
                    }`}
                  />
                  {errors.name && (
                    <p className="text-red-400 text-xs mt-1">{errors.name}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cliente@email.com"
                    className={`w-full px-4 py-3 rounded-xl bg-slate-900 border text-slate-200 focus:outline-none focus:ring-1 transition-colors ${
                      errors.email
                        ? "border-red-400/50 focus:border-red-400 focus:ring-red-400/30"
                        : "border-slate-700 focus:border-cyan-400/50 focus:ring-cyan-400/30"
                    }`}
                  />
                  {errors.email && (
                    <p className="text-red-400 text-xs mt-1">{errors.email}</p>
                  )}
                </div>

                {/* Telefone */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+55 11 99999-9999"
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:ring-1 focus:border-cyan-400/50 focus:ring-cyan-400/30 transition-colors"
                  />
                </div>

                {/* WhatsApp */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                    WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="+55 11 99999-9999"
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:ring-1 focus:border-cyan-400/50 focus:ring-cyan-400/30 transition-colors"
                  />
                </div>

                {/* Logo URL */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                    URL do Logo
                  </label>
                  <input
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://..."
                    className={`w-full px-4 py-3 rounded-xl bg-slate-900 border text-slate-200 focus:outline-none focus:ring-1 transition-colors ${
                      errors.logo_url
                        ? "border-red-400/50 focus:border-red-400 focus:ring-red-400/30"
                        : "border-slate-700 focus:border-cyan-400/50 focus:ring-cyan-400/30"
                    }`}
                  />
                  {errors.logo_url && (
                    <p className="text-red-400 text-xs mt-1">{errors.logo_url}</p>
                  )}
                </div>

                {/* Ad Accounts */}
                {!client && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
                      Contas de Anúncio
                    </label>
                    {fetchingAccounts ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                      </div>
                    ) : accounts.length === 0 ? (
                      <p className="text-sm text-slate-500">
                        Nenhuma conta disponível. Conecte uma conta primeiro.
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {accounts.map((account) => {
                          const isSelected = selectedAccounts.includes(account.id);
                          return (
                            <button
                              key={account.id}
                              type="button"
                              onClick={() => toggleAccount(account.id)}
                              className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                isSelected
                                  ? "bg-cyan-400/10 border-cyan-400/30 text-cyan-400"
                                  : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                {account.name || account.external_id}
                                {isSelected && <Check size={14} />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Notas */}
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                    Notas
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Observações sobre o cliente..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:ring-1 focus:border-cyan-400/50 focus:ring-cyan-400/30 transition-colors resize-none"
                  />
                </div>
              </form>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-6 py-2 bg-cyan-400 text-slate-950 font-bold rounded-xl hover:bg-cyan-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Cliente"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
