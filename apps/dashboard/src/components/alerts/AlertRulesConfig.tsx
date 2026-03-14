"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Power, Trash2, Shield, Zap } from "lucide-react";
import type { AlertRuleInput, NotificationRuleRow } from "@/lib/alerts/types";
import type { DashboardCampaignRow } from "@/lib/dashboard/types";

type AlertRulesConfigProps = {
  rules: NotificationRuleRow[];
  campaigns: DashboardCampaignRow[];
  onCreateRule: (payload: AlertRuleInput) => Promise<unknown>;
  onToggleRule: (params: { id: string; active: boolean }) => void;
  onDeleteRule: (id: string) => void;
  isCreating: boolean;
  activeRulesCount: number;
};

type NewRuleFormState = {
  metric: AlertRuleInput["metric"];
  operator: AlertRuleInput["operator"];
  threshold: string;
  campaign_id: string;
};

function metricLabel(metric: string): string {
  if (metric === "roas") return "ROAS";
  if (metric === "cpa") return "CPA";
  return "Gasto sem conversão";
}

function operatorLabel(operator: string): string {
  if (operator === "lt") return "<";
  if (operator === "gt") return ">";
  return "=";
}

function metricHint(metric: string): string {
  if (metric === "roas") return "Dispara quando o ROAS ficar abaixo do limite";
  if (metric === "cpa") return "Dispara quando o CPA ultrapassar o limite";
  return "Dispara quando houver gasto acima do limite sem nenhuma conversão";
}

const DEFAULT_FORM: NewRuleFormState = {
  metric: "roas",
  operator: "lt",
  threshold: "2",
  campaign_id: "all",
};

export function AlertRulesConfig({
  rules,
  campaigns,
  onCreateRule,
  onToggleRule,
  onDeleteRule,
  isCreating,
  activeRulesCount,
}: AlertRulesConfigProps) {
  const [form, setForm] = useState<NewRuleFormState>(DEFAULT_FORM);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const threshold = Number.parseFloat(form.threshold);
    if (!Number.isFinite(threshold) || threshold < 0) return;

    await onCreateRule({
      metric: form.metric,
      operator: form.operator,
      threshold,
      campaign_id: form.campaign_id === "all" ? null : form.campaign_id,
      active: true,
    });

    setForm(DEFAULT_FORM);
  }

  function handleDelete(id: string) {
    if (deleteConfirmId === id) {
      onDeleteRule(id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  }

  return (
    <div className="glass rounded-2xl p-6 mt-8" id="alerts-config-section">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/10">
            <Shield size={18} className="text-cyan-400" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">Configuração de Alertas</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeRulesCount} regra{activeRulesCount !== 1 ? "s" : ""} ativa{activeRulesCount !== 1 ? "s" : ""}
              {" · "}Monitoramento a cada 15 min
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
          <Zap size={12} className="text-emerald-400" />
          <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">
            Ativo
          </span>
        </div>
      </div>

      {/* Form de criação */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-6 gap-3 mb-6 mt-5 items-end"
        id="alert-rule-create-form"
      >
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-semibold">
            Métrica
          </label>
          <select
            value={form.metric}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                metric: e.target.value as NewRuleFormState["metric"],
                operator: e.target.value === "cpa" ? "gt" : e.target.value === "roas" ? "lt" : "gt",
              }))
            }
            className="w-full glass rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
          >
            <option value="roas">ROAS</option>
            <option value="cpa">CPA</option>
            <option value="spend_no_conversion">Gasto sem conversão</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-semibold">
            Operador
          </label>
          <select
            value={form.operator}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, operator: e.target.value as NewRuleFormState["operator"] }))
            }
            className="w-full glass rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
          >
            <option value="lt">{"< Menor que"}</option>
            <option value="gt">{"> Maior que"}</option>
            <option value="eq">{"= Igual a"}</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-semibold">
            Threshold
          </label>
          <input
            value={form.threshold}
            onChange={(e) => setForm((prev) => ({ ...prev, threshold: e.target.value }))}
            type="number"
            step="0.01"
            min="0"
            className="w-full glass rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
            placeholder="Ex: 2.00"
            required
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-[10px] uppercase tracking-wider text-slate-500 mb-1.5 font-semibold">
            Campanha
          </label>
          <select
            value={form.campaign_id}
            onChange={(e) => setForm((prev) => ({ ...prev, campaign_id: e.target.value }))}
            className="w-full glass rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30"
          >
            <option value="all">🌐 Todas as campanhas</option>
            {campaigns.map((c) => (
              <option key={c.campaignId} value={c.campaignId}>
                {c.campaignName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <button
            type="submit"
            disabled={isCreating}
            className="w-full rounded-xl bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 border border-cyan-400/30 px-4 py-2.5 text-sm text-cyan-200 hover:from-cyan-500/30 hover:to-indigo-500/30 disabled:opacity-50 transition-all font-semibold inline-flex items-center justify-center gap-2"
            id="alert-rule-create-button"
          >
            <Plus size={14} />
            {isCreating ? "Salvando..." : "Criar"}
          </button>
        </div>
      </form>

      {/* Hint */}
      <p className="text-[10px] text-slate-600 mb-5 -mt-3 italic">
        💡 {metricHint(form.metric)}
      </p>

      {/* Lista de regras */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {rules.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="py-6 text-center"
            >
              <Shield size={28} className="text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-500">Nenhuma regra configurada</p>
              <p className="text-[10px] text-slate-600 mt-1">
                Crie regras acima para monitorar ROAS, CPA e gastos sem conversão
              </p>
            </motion.div>
          ) : (
            rules.map((rule) => (
              <motion.div
                key={rule.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95, height: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className={`flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 rounded-xl border transition-colors ${
                  rule.active
                    ? "border-slate-700/50 bg-slate-900/30"
                    : "border-slate-800/30 bg-slate-900/10 opacity-60"
                }`}
                id={`alert-rule-${rule.id}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      rule.active ? "bg-emerald-400 shadow-lg shadow-emerald-400/30" : "bg-slate-600"
                    }`}
                  />
                  <div className="text-sm text-slate-200">
                    <span className="font-bold">{metricLabel(rule.metric)}</span>{" "}
                    <span className="text-slate-500 font-mono">{operatorLabel(rule.operator)}</span>{" "}
                    <span className="text-cyan-300 font-semibold font-mono">{Number(rule.threshold).toFixed(2)}</span>
                    <span className="text-xs text-slate-600 ml-3">
                      {rule.campaign_id ? "Campanha específica" : "Todas campanhas"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onToggleRule({ id: rule.id, active: !rule.active })}
                    className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                      rule.active
                        ? "border-emerald-500/30 text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20"
                        : "border-slate-700 text-slate-500 bg-slate-800/30 hover:bg-slate-700/40"
                    }`}
                  >
                    <Power size={12} />
                    {rule.active ? "Ativo" : "Inativo"}
                  </button>

                  <button
                    onClick={() => handleDelete(rule.id)}
                    className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-all ${
                      deleteConfirmId === rule.id
                        ? "border-red-500/40 text-red-300 bg-red-500/15 hover:bg-red-500/25"
                        : "border-slate-800/40 text-slate-600 hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/5"
                    }`}
                    aria-label={deleteConfirmId === rule.id ? "Confirmar exclusão" : "Excluir regra"}
                  >
                    <Trash2 size={12} />
                    {deleteConfirmId === rule.id ? "Confirmar?" : ""}
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
