"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  Mail,
  MessageCircle,
  Pause,
  Play,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import type { ScheduledReportRow, ReportExecutionRow } from "./page";

type Props = {
  reports: ScheduledReportRow[];
  executions: ReportExecutionRow[];
};

const FREQUENCY_LABEL: Record<string, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
};

const FREQUENCY_COLOR: Record<string, string> = {
  daily: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  weekly: "text-violet-400 bg-violet-400/10 border-violet-400/20",
  monthly: "text-amber-400 bg-amber-400/10 border-amber-400/20",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  completed: <CheckCircle2 size={14} className="text-emerald-400" />,
  failed: <XCircle size={14} className="text-red-400" />,
  generating: <Loader2 size={14} className="text-cyan-400 animate-spin" />,
  pending: <Clock size={14} className="text-slate-400" />,
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Create Report Modal ─────────────────────────────────────────────────────

type CreateForm = {
  name: string;
  frequency: "daily" | "weekly" | "monthly";
  recipients: string;
  whatsapp_enabled: boolean;
};

function CreateReportModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<CreateForm>({
    name: "",
    frequency: "weekly",
    recipients: "",
    whatsapp_enabled: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          frequency: form.frequency,
          recipients: form.recipients
            .split(",")
            .map((r) => r.trim())
            .filter(Boolean),
          whatsapp_enabled: form.whatsapp_enabled,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Erro ao criar relatório");
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setError("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md glass rounded-[2rem] p-6 border border-white/10 shadow-2xl"
      >
        <div className="mb-6">
          <p className="text-[10px] text-cyan-400/70 uppercase tracking-[0.2em] font-semibold mb-1">
            Novo
          </p>
          <h2 className="text-xl font-black text-white tracking-tight">Criar Relatório</h2>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nome */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Nome do relatório
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Relatório Semanal de Campanhas"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-colors"
            />
          </div>

          {/* Frequência */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              Frequência
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["daily", "weekly", "monthly"] as const).map((freq) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, frequency: freq }))}
                  className={`py-2 rounded-xl text-xs font-black uppercase tracking-wider border transition-all duration-200 ${
                    form.frequency === freq
                      ? "bg-cyan-500/10 border-cyan-400/40 text-cyan-300"
                      : "bg-white/5 border-white/10 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {FREQUENCY_LABEL[freq]}
                </button>
              ))}
            </div>
          </div>

          {/* Destinatários */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
              <Mail size={12} className="inline mr-1" />
              E-mails (separados por vírgula)
            </label>
            <input
              type="text"
              placeholder="email@empresa.com, outro@empresa.com"
              value={form.recipients}
              onChange={(e) => setForm((f) => ({ ...f, recipients: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-colors"
            />
          </div>

          {/* WhatsApp toggle */}
          <div
            className="flex items-center justify-between glass rounded-xl px-4 py-3 border border-white/10 cursor-pointer"
            onClick={() => setForm((f) => ({ ...f, whatsapp_enabled: !f.whatsapp_enabled }))}
          >
            <div className="flex items-center gap-2.5">
              <MessageCircle size={16} className="text-emerald-400" />
              <div>
                <p className="text-sm font-semibold text-white">Enviar via WhatsApp</p>
                <p className="text-xs text-slate-500">Requer instância conectada</p>
              </div>
            </div>
            <div
              className={`w-10 h-5 rounded-full transition-colors duration-200 relative ${
                form.whatsapp_enabled ? "bg-emerald-500/80" : "bg-white/10"
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all duration-200 ${
                  form.whatsapp_enabled ? "left-5" : "left-0.5"
                }`}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider bg-white/5 border border-white/10 text-slate-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-black uppercase tracking-wider bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-[1.02] transition-all disabled:opacity-60 disabled:scale-100"
            >
              {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Criar"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ReportsClient({ reports: initialReports, executions }: Props) {
  const [reports, setReports] = useState(initialReports);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<"reports" | "history">("reports");

  async function refreshReports() {
    try {
      const res = await fetch("/api/reports");
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports ?? []);
      }
    } catch {
      // silently ignore
    }
  }

  return (
    <>
      <AnimatePresence>
        {showCreate && (
          <CreateReportModal
            onClose={() => setShowCreate(false)}
            onSuccess={refreshReports}
          />
        )}
      </AnimatePresence>

      <main className="flex-1 p-4 md:p-8 overflow-y-auto min-w-0">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] text-cyan-400/70 uppercase tracking-[0.2em] font-semibold mb-1">
                Automação
              </p>
              <h1 className="text-3xl font-extrabold text-white tracking-tight leading-none">
                Relatórios
              </h1>
              <p className="text-sm text-slate-500 mt-2">
                Agende relatórios automáticos por e-mail ou WhatsApp.
              </p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-105 transition-all shrink-0"
            >
              <Plus size={14} />
              Novo Relatório
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 glass rounded-2xl p-1 border border-white/5 w-fit">
            {(["reports", "history"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 ${
                  activeTab === tab
                    ? "bg-white/10 text-white border border-white/10"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {tab === "reports" ? "Agendamentos" : "Histórico"}
              </button>
            ))}
          </div>

          {/* Tab: Agendamentos */}
          {activeTab === "reports" && (
            <div className="space-y-3">
              {reports.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col items-center justify-center p-16 glass rounded-[2.5rem] border border-white/5 text-center"
                >
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                    <FileText size={28} className="text-slate-500/50" />
                  </div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">
                    Nenhum relatório agendado
                  </h3>
                  <p className="text-sm text-slate-500 max-w-xs mb-6">
                    Crie seu primeiro relatório automático para receber métricas por e-mail ou WhatsApp.
                  </p>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:scale-105 transition-all"
                  >
                    <Plus size={14} />
                    Criar primeiro relatório
                  </button>
                </motion.div>
              ) : (
                reports.map((report, i) => (
                  <motion.div
                    key={report.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="glass rounded-2xl p-5 border border-white/5 hover:border-white/10 transition-colors group"
                  >
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                          <FileText size={18} className="text-cyan-400" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-black text-white text-sm tracking-tight truncate">
                            {report.name}
                          </p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span
                              className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                FREQUENCY_COLOR[report.frequency] ?? "text-slate-400 bg-slate-400/10 border-slate-400/20"
                              }`}
                            >
                              {FREQUENCY_LABEL[report.frequency] ?? report.frequency}
                            </span>
                            {report.whatsapp_enabled && (
                              <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border text-emerald-400 bg-emerald-400/10 border-emerald-400/20 flex items-center gap-1">
                                <MessageCircle size={10} />
                                WhatsApp
                              </span>
                            )}
                            {report.recipients.length > 0 && (
                              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                <Mail size={10} />
                                {report.recipients.length} dest.
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right hidden sm:block">
                          <p className="text-[10px] text-slate-600 uppercase tracking-wider">Próxima execução</p>
                          <p className="text-xs font-semibold text-slate-400">
                            {formatDate(report.next_run_at)}
                          </p>
                        </div>
                        <div
                          className={`w-2 h-2 rounded-full ${
                            report.status === "active"
                              ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]"
                              : report.status === "error"
                              ? "bg-red-400"
                              : "bg-slate-600"
                          }`}
                        />
                        <ChevronRight size={16} className="text-slate-600 group-hover:text-slate-400 transition-colors" />
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}

          {/* Tab: Histórico */}
          {activeTab === "history" && (
            <div className="space-y-2">
              {executions.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 glass rounded-[2.5rem] border border-white/5 text-center">
                  <Clock size={28} className="text-slate-500/50 mb-4" />
                  <h3 className="text-lg font-black text-white uppercase tracking-tight mb-2">
                    Sem execuções ainda
                  </h3>
                  <p className="text-sm text-slate-500">
                    O histórico aparecerá após o primeiro relatório ser gerado.
                  </p>
                </div>
              ) : (
                executions.map((ex, i) => (
                  <motion.div
                    key={ex.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="glass rounded-xl px-5 py-3 border border-white/5 flex items-center gap-4"
                  >
                    <div className="shrink-0">{STATUS_ICON[ex.status]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">
                        {(ex.scheduled_reports as any)?.name ?? "Relatório"}
                      </p>
                      {ex.error_message && (
                        <p className="text-xs text-red-400 truncate">{ex.error_message}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-slate-500">{formatDate(ex.created_at)}</p>
                      <p
                        className={`text-[10px] font-black uppercase tracking-wider mt-0.5 ${
                          ex.status === "completed"
                            ? "text-emerald-400"
                            : ex.status === "failed"
                            ? "text-red-400"
                            : "text-slate-500"
                        }`}
                      >
                        {ex.status}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
