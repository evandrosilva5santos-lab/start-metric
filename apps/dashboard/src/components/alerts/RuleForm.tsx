"use client";

import { useId, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ALERT_TEMPLATE_VARIABLES, defaultTemplate, presetFor } from "@/lib/alerts/message";
import { metricLabel, thresholdHint } from "@/lib/alerts/present";
import { SUPPORTED_RULE_METRICS, TEMPLATE_BODY_MAX } from "@/lib/alerts/schemas";
import type { AlertRuleInput, SupportedAlertMetric } from "@/lib/alerts/types";
import { FIELD_CLASS } from "./triage/TriageFilters";
import type { RuleScopeOptions } from "./AlertRulesConfig";

const API_ERROR_DEFAULT_HOURS = 24;

type RuleFormProps = {
  options: RuleScopeOptions;
  isSaving: boolean;
  error: string | null;
  onCreate: (payload: AlertRuleInput) => Promise<unknown>;
};

function defaultThreshold(metric: SupportedAlertMetric): string {
  if (metric === "api_error") return String(API_ERROR_DEFAULT_HOURS);
  return String(presetFor(metric)?.defaultThreshold ?? "");
}

function Field({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-[12px] font-medium text-fg-muted">
        {label}
      </label>
      {children}
      {hint && <p className="text-[12px] text-fg-muted">{hint}</p>}
    </div>
  );
}

export function RuleForm({ options, isSaving, error, onCreate }: RuleFormProps) {
  const id = useId();
  const templateRef = useRef<HTMLTextAreaElement>(null);
  const [metric, setMetric] = useState<SupportedAlertMetric>("roas");
  const [threshold, setThreshold] = useState(defaultThreshold("roas"));
  const [clientId, setClientId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [campaignId, setCampaignId] = useState("");
  const [template, setTemplate] = useState(defaultTemplate("roas"));
  const [templateTouched, setTemplateTouched] = useState(false);

  const accounts = options.accounts.filter((account) => !clientId || account.client_id === clientId);
  const accountIds = new Set(accounts.map((account) => account.id));
  const campaigns = options.campaigns.filter((campaign) =>
    accountId ? campaign.ad_account_id === accountId : !clientId || accountIds.has(campaign.ad_account_id),
  );

  const changeMetric = (next: SupportedAlertMetric) => {
    setMetric(next);
    setThreshold(defaultThreshold(next));
    if (next === "api_error") setCampaignId("");
    if (!templateTouched) setTemplate(defaultTemplate(next));
  };

  const insertVariable = (slug: string) => {
    const token = `{{${slug}}}`;
    const field = templateRef.current;
    const start = field?.selectionStart ?? template.length;
    const end = field?.selectionEnd ?? template.length;
    setTemplate(`${template.slice(0, start)}${token}${template.slice(end)}`);
    setTemplateTouched(true);
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const reset = () => {
    setThreshold(defaultThreshold(metric));
    setCampaignId("");
    setTemplate(defaultTemplate(metric));
    setTemplateTouched(false);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = Number.parseFloat(threshold.replace(",", "."));
    if (!Number.isFinite(value) || value < 0) return;
    const isPreset = template.trim() === defaultTemplate(metric).trim();
    try {
      await onCreate({
        metric,
        threshold: value,
        client_id: clientId || null,
        ad_account_id: accountId || null,
        campaign_id: metric === "api_error" ? null : campaignId || null,
        template_body: isPreset || !template.trim() ? null : template,
        active: true,
      });
      reset();
    } catch {
      return;
    }
  };

  return (
    <form onSubmit={submit} aria-labelledby={`${id}-titulo`} className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-4 shadow-card sm:p-5">
      <h2 id={`${id}-titulo`} className="text-[16px] font-semibold text-fg">
        Nova regra
      </h2>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field id={`${id}-condicao`} label="Condição">
          <select id={`${id}-condicao`} value={metric} onChange={(e) => changeMetric(e.target.value as SupportedAlertMetric)} className={FIELD_CLASS}>
            {SUPPORTED_RULE_METRICS.map((option) => (
              <option key={option} value={option}>
                {metricLabel(option)}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-limite`} label="Limite" hint={thresholdHint(metric)}>
          <input
            id={`${id}-limite`}
            inputMode="decimal"
            required
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            pattern="[0-9]+([.,][0-9]{1,2})?"
            className={`${FIELD_CLASS} num`}
          />
        </Field>
        <Field id={`${id}-cliente`} label="Cliente">
          <select
            id={`${id}-cliente`}
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setAccountId("");
              setCampaignId("");
            }}
            className={FIELD_CLASS}
          >
            <option value="">Todos os clientes</option>
            {options.clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`${id}-conta`} label="Conta de anúncio">
          <select
            id={`${id}-conta`}
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setCampaignId("");
            }}
            className={FIELD_CLASS}
          >
            <option value="">{clientId ? "Todas as contas do cliente" : "Todas as contas"}</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name || "Conta sem nome"}
              </option>
            ))}
          </select>
        </Field>
        {metric !== "api_error" && (
          <div className="sm:col-span-2">
            <Field id={`${id}-campanha`} label="Campanha" hint="Sem campanha, a regra olha cada conta somada.">
              <select id={`${id}-campanha`} value={campaignId} onChange={(e) => setCampaignId(e.target.value)} className={FIELD_CLASS}>
                <option value="">Conta inteira</option>
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-modelo`} className="text-[12px] font-medium text-fg-muted">
          Mensagem do alerta
        </label>
        <textarea
          id={`${id}-modelo`}
          ref={templateRef}
          rows={7}
          maxLength={TEMPLATE_BODY_MAX}
          value={template}
          onChange={(e) => {
            setTemplate(e.target.value);
            setTemplateTouched(true);
          }}
          className="w-full rounded-control border border-border-strong bg-surface p-2.5 font-mono text-[13px] leading-[1.5] text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex flex-col gap-1.5">
          <p id={`${id}-variaveis`} className="text-[12px] text-fg-muted">
            Variáveis (toque para inserir). Sem dado, a variável vira —.
          </p>
          <ul aria-labelledby={`${id}-variaveis`} className="flex flex-wrap gap-1.5">
            {ALERT_TEMPLATE_VARIABLES.map((variable) => (
              <li key={variable.slug}>
                <button
                  type="button"
                  onClick={() => insertVariable(variable.slug)}
                  className="inline-flex h-11 items-center rounded-full border border-border bg-subtle px-2.5 text-[12px] text-fg transition-colors hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-7"
                >
                  <span className="font-mono">{`{{${variable.slug}}}`}</span>
                  <span className="ml-1.5 text-fg-muted">{variable.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" loading={isSaving}>
          <Plus size={16} aria-hidden="true" />
          Criar regra
        </Button>
        {templateTouched && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setTemplate(defaultTemplate(metric));
              setTemplateTouched(false);
            }}
          >
            Voltar ao modelo padrão
          </Button>
        )}
      </div>
    </form>
  );
}
