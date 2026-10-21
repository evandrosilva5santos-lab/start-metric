"use client";

import { useState } from "react";
import { Power, RefreshCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAlertRules } from "@/hooks/useAlertTriage";
import { formatMetricValue } from "@/lib/alerts/message";
import { metricLabel, operatorSymbol } from "@/lib/alerts/present";
import type { NotificationRuleRow } from "@/lib/alerts/types";
import { RuleForm } from "./RuleForm";

export type RuleScopeOptions = {
  clients: { id: string; name: string }[];
  accounts: { id: string; name: string | null; client_id: string | null }[];
  campaigns: { id: string; name: string; ad_account_id: string }[];
};

type AlertRulesConfigProps = {
  options: RuleScopeOptions;
  optionsFailed: boolean;
};

const CONFIRM_WINDOW_MS = 3000;

function scopeText(rule: NotificationRuleRow, options: RuleScopeOptions): string {
  const campaign = options.campaigns.find((item) => item.id === rule.campaign_id)?.name;
  const account = options.accounts.find((item) => item.id === rule.ad_account_id)?.name;
  const client = options.clients.find((item) => item.id === rule.client_id)?.name;
  if (rule.campaign_id) return `Campanha: ${campaign ?? "—"}`;
  if (rule.ad_account_id) return `Conta: ${account ?? "—"}`;
  if (rule.client_id) return `Cliente: ${client ?? "—"} · cada conta`;
  return "Todas as contas";
}

export function AlertRulesConfig({ options, optionsFailed }: AlertRulesConfigProps) {
  const { rulesQuery, create, toggle, remove } = useAlertRules();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const rules = rulesQuery.data ?? [];
  const activeCount = rules.filter((rule) => rule.active).length;

  const askDelete = (id: string) => {
    if (confirmId === id) {
      remove.mutate(id);
      setConfirmId(null);
      return;
    }
    setConfirmId(id);
    window.setTimeout(() => setConfirmId((current) => (current === id ? null : current)), CONFIRM_WINDOW_MS);
  };

  return (
    <div className="flex flex-col gap-5">
      {optionsFailed && (
        <p role="status" className="rounded-control border-l-[3px] border-warning bg-warning-tint px-3 py-2 text-[13px] text-fg">
          Não deu para carregar clientes, contas e campanhas. A regra pode ser criada para todas as contas; recarregue a
          página para escolher um escopo.
        </p>
      )}

      <RuleForm
        options={options}
        isSaving={create.isPending}
        error={create.isError ? create.error.message : null}
        onCreate={(payload) => create.mutateAsync(payload)}
      />

      <section aria-labelledby="regras-lista-titulo" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="regras-lista-titulo" className="text-[16px] font-semibold text-fg">
            Regras
          </h2>
          <p className="num text-[13px] text-fg-muted">
            {activeCount} ativa{activeCount === 1 ? "" : "s"} de {rules.length} · avaliadas uma vez por dia, de madrugada, com o dia anterior completo
          </p>
        </div>

        <p className="text-[12px] text-fg-muted">
          Saldo baixo ainda não está disponível: o painel não lê o saldo da conta na Meta.
        </p>

        {rulesQuery.isPending ? (
          <div role="status" aria-label="Carregando regras" className="h-24 animate-pulse rounded-panel bg-subtle motion-reduce:animate-none" />
        ) : rulesQuery.isError ? (
          <div role="alert" className="flex flex-col gap-2 rounded-panel border border-border border-l-[3px] border-l-danger bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[14px] text-fg">Não deu para carregar as regras: {rulesQuery.error.message}</p>
            <Button variant="secondary" onClick={() => rulesQuery.refetch()}>
              <RefreshCw size={16} aria-hidden="true" />
              Tentar de novo
            </Button>
          </div>
        ) : rules.length === 0 ? (
          <p className="rounded-panel border border-dashed border-border-strong bg-surface p-6 text-center text-[14px] text-fg-muted">
            Nenhuma regra ainda. Crie a primeira acima.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-panel border border-border bg-surface shadow-card">
            {rules.map((rule) => {
              const isConfirming = confirmId === rule.id;
              return (
                <li key={rule.id} className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 flex-col gap-1">
                    <p className="text-[14px] font-medium text-fg">
                      {metricLabel(rule.metric)}{" "}
                      <span className="num text-fg-muted">
                        {operatorSymbol(rule.operator)} {formatMetricValue(rule.metric, Number(rule.threshold))}
                      </span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-[12px] text-fg-muted">
                      <span>{scopeText(rule, options)}</span>
                      <Badge variant={rule.template_body ? "cli" : "neu"} dot={false}>
                        {rule.template_body ? "Mensagem própria" : "Mensagem padrão"}
                      </Badge>
                      {rule.metric === "balance_below" && <Badge variant="off">Não avaliada</Badge>}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-pressed={rule.active}
                      disabled={toggle.isPending && toggle.variables?.id === rule.id}
                      onClick={() => toggle.mutate({ id: rule.id, active: !rule.active })}
                    >
                      <Power size={14} aria-hidden="true" />
                      {rule.active ? "Ativa" : "Pausada"}
                    </Button>
                    <Button
                      variant={isConfirming ? "danger" : "ghost"}
                      size="sm"
                      onClick={() => askDelete(rule.id)}
                      aria-label={isConfirming ? "Confirmar exclusão da regra" : "Excluir regra"}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      {isConfirming ? "Confirmar?" : null}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {(toggle.isError || remove.isError) && (
          <p role="alert" className="text-[13px] text-danger">
            {(toggle.error ?? remove.error)?.message}
          </p>
        )}
      </section>
    </div>
  );
}
