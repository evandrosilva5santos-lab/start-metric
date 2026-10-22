"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Pause, Play, Plus, ShieldAlert, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui";

type Rule = {
  id: string;
  client_id: string | null;
  ad_account_id: string;
  name: string;
  platform: "meta" | "google";
  entity_external_id: string | null;
  entity_name: string | null;
  metric: string;
  operator: "above" | "below";
  value: number;
  period: string;
  min_spend: number;
  action: string;
  action_percent: number | null;
  mode: "simulate" | "execute";
  is_active: boolean;
  cooldown_hours: number;
  max_actions_per_day: number;
  last_evaluated_at: string | null;
  last_triggered_at: string | null;
};
type Account = { id: string; name: string | null; external_id: string; platform: string; client_id: string | null };
type Client = { id: string; name: string };
type Run = {
  id: string;
  entity_name: string | null;
  action: string;
  mode: string;
  status: "simulated" | "executed" | "failed" | "skipped";
  detail: string | null;
  created_at: string;
  automation_rules: { name: string } | null;
};
type TestDecision = { campaign: string; description: string; skipped: string | null };

const METRICS: Record<string, string> = { cpa: "CPA", roas: "ROAS", ctr: "CTR (%)", cpc: "CPC", cpm: "CPM", spend: "Gasto", conversions: "Conversões" };
const PERIODS: Record<string, string> = { today: "hoje", yesterday: "ontem", last_3d: "últimos 3 dias", last_7d: "últimos 7 dias" };
const ACTIONS: Record<string, string> = {
  pause: "pausar a campanha",
  activate: "ativar a campanha",
  decrease_budget: "baixar o orçamento",
  increase_budget: "subir o orçamento",
  notify: "só avisar",
};
const STATUS: Record<Run["status"], { label: string; className: string }> = {
  simulated: { label: "Simulado", className: "bg-muted text-muted-foreground" },
  executed: { label: "Executado", className: "bg-success-tint text-success" },
  failed: { label: "Falhou", className: "bg-danger-tint text-danger" },
  skipped: { label: "Ignorado", className: "bg-muted text-muted-foreground" },
};

const inputClass =
  "mt-1 h-11 w-full rounded-lg border border-border bg-input px-3 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 lg:h-9";

async function send<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`);
  return json;
}

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function ruleSentence(rule: Rule): string {
  const target = rule.entity_name ? `a campanha "${rule.entity_name}"` : "qualquer campanha da conta";
  const percent = rule.action_percent ? ` em ${rule.action_percent}%` : "";
  const minSpend = Number(rule.min_spend) > 0 ? ` (com gasto de pelo menos ${brl(Number(rule.min_spend))})` : "";
  const direction = rule.operator === "above" ? "acima" : "abaixo";
  return `Se ${METRICS[rule.metric] ?? rule.metric} de ${target} ficar ${direction} de ${Number(rule.value).toLocaleString("pt-BR")} nos ${PERIODS[rule.period] ?? rule.period}${minSpend}, ${ACTIONS[rule.action] ?? rule.action}${percent}.`;
}

const accountLabel = (a: Account | undefined) => (a ? `${a.platform === "google" ? "Google" : "Meta"} · ${a.name ?? a.external_id}` : "Conta removida");

const EMPTY_FORM = {
  name: "",
  clientId: "",
  adAccountId: "",
  entityExternalId: "",
  metric: "cpa",
  operator: "above",
  value: "",
  period: "last_3d",
  minSpend: "",
  action: "pause",
  actionPercent: "20",
  cooldownHours: "24",
  maxActionsPerDay: "3",
};
type FormState = typeof EMPTY_FORM;

const toNumber = (s: string) => Number(s.replace(",", "."));

function NewRuleForm({ accounts, clients, onDone }: { accounts: Account[]; clients: Client[]; onDone: () => void }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof FormState, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const clientAccounts = accounts.filter((a) => a.client_id === form.clientId);
  const campaigns = useQuery({
    queryKey: ["automation", "campaigns", form.adAccountId],
    enabled: Boolean(form.adAccountId),
    queryFn: () => send<{ campaigns: Array<{ id: string; name: string; status: string }> }>(`/api/automation/campaigns?accountId=${form.adAccountId}`, "GET"),
  });
  const budgetAction = form.action === "increase_budget" || form.action === "decrease_budget";

  const create = useMutation({
    mutationFn: () => {
      const campaign = campaigns.data?.campaigns.find((c) => c.id === form.entityExternalId);
      return send("/api/automation/rules", "POST", {
        name: form.name.trim(),
        adAccountId: form.adAccountId,
        entityExternalId: form.entityExternalId || null,
        entityName: campaign?.name ?? null,
        metric: form.metric,
        operator: form.operator,
        value: toNumber(form.value),
        period: form.period,
        minSpend: toNumber(form.minSpend || "0"),
        action: form.action,
        actionPercent: budgetAction ? toNumber(form.actionPercent) : null,
        cooldownHours: toNumber(form.cooldownHours),
        maxActionsPerDay: toNumber(form.maxActionsPerDay),
      });
    },
    onSuccess: () => {
      setForm(EMPTY_FORM);
      setError(null);
      onDone();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Erro ao salvar"),
  });

  return (
    <form
      className="space-y-4 rounded-lg border border-border bg-card p-4 md:p-5"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <h2 className="font-display text-base font-semibold text-fg">Nova regra</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="text-xs text-fg-muted">
          Nome
          <input className={inputClass} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ex.: CPA alto pausa" required maxLength={120} />
        </label>
        <label className="text-xs text-fg-muted">
          Cliente
          <select
            className={inputClass}
            value={form.clientId}
            onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value, adAccountId: "", entityExternalId: "" }))}
            required
          >
            <option value="">Escolha…</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-fg-muted">
          Conta
          <select
            className={inputClass}
            value={form.adAccountId}
            onChange={(e) => setForm((f) => ({ ...f, adAccountId: e.target.value, entityExternalId: "" }))}
            required
            disabled={!form.clientId}
          >
            <option value="">{form.clientId && clientAccounts.length === 0 ? "Cliente sem conta vinculada" : "Escolha…"}</option>
            {clientAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {accountLabel(a)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-fg-muted md:col-span-3">
          Campanha
          <select className={inputClass} value={form.entityExternalId} onChange={(e) => set("entityExternalId", e.target.value)} disabled={!form.adAccountId}>
            <option value="">{campaigns.isFetching ? "Carregando campanhas…" : "Todas as campanhas da conta"}</option>
            {campaigns.data?.campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.status === "ACTIVE" || c.status === "ENABLED" ? "" : ` (${c.status.toLowerCase()})`}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
        <label className="text-xs text-fg-muted">
          Quando
          <select className={inputClass} value={form.metric} onChange={(e) => set("metric", e.target.value)}>
            {Object.entries(METRICS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-fg-muted">
          ficar
          <select className={inputClass} value={form.operator} onChange={(e) => set("operator", e.target.value)}>
            <option value="above">acima de</option>
            <option value="below">abaixo de</option>
          </select>
        </label>
        <label className="text-xs text-fg-muted">
          Valor
          <input className={inputClass} value={form.value} onChange={(e) => set("value", e.target.value)} inputMode="decimal" placeholder="50" required />
        </label>
        <label className="text-xs text-fg-muted">
          No período
          <select className={inputClass} value={form.period} onChange={(e) => set("period", e.target.value)}>
            {Object.entries(PERIODS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-fg-muted">
          Então
          <select className={inputClass} value={form.action} onChange={(e) => set("action", e.target.value)}>
            {Object.entries(ACTIONS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        {budgetAction && (
          <label className="text-xs text-fg-muted">
            Ajuste (%)
            <input className={inputClass} value={form.actionPercent} onChange={(e) => set("actionPercent", e.target.value)} inputMode="numeric" required />
          </label>
        )}
        <label className="text-xs text-fg-muted">
          Gasto mínimo (R$)
          <input className={inputClass} value={form.minSpend} onChange={(e) => set("minSpend", e.target.value)} inputMode="decimal" placeholder="0" />
        </label>
        <label className="text-xs text-fg-muted">
          Carência (horas)
          <input className={inputClass} value={form.cooldownHours} onChange={(e) => set("cooldownHours", e.target.value)} inputMode="numeric" />
        </label>
        <label className="text-xs text-fg-muted">
          Máx. ações por dia
          <input className={inputClass} value={form.maxActionsPerDay} onChange={(e) => set("maxActionsPerDay", e.target.value)} inputMode="numeric" />
        </label>
      </div>

      <p className="text-xs text-fg-muted">
        A regra começa em modo <strong>simular</strong>: registra o que faria, sem mexer na conta. Você liga a execução depois de conferir.
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <Button type="submit" loading={create.isPending}>
        <Plus /> Criar regra
      </Button>
    </form>
  );
}

function RuleCard({ rule, account, onChanged }: { rule: Rule; account: Account | undefined; onChanged: () => void }) {
  const [tests, setTests] = useState<TestDecision[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const onError = (err: unknown) => setError(err instanceof Error ? err.message : "Erro");
  const patch = useMutation({
    mutationFn: (body: Record<string, unknown>) => send(`/api/automation/rules/${rule.id}`, "PATCH", body),
    onSuccess: () => {
      setError(null);
      onChanged();
    },
    onError,
  });
  const remove = useMutation({ mutationFn: () => send(`/api/automation/rules/${rule.id}`, "DELETE"), onSuccess: onChanged, onError });
  const test = useMutation({
    mutationFn: () => send<{ decisions: TestDecision[] }>(`/api/automation/rules/${rule.id}/test`, "POST"),
    onSuccess: (data) => {
      setError(null);
      setTests(data.decisions);
    },
    onError,
  });
  const executing = rule.mode === "execute";

  return (
    <li className="space-y-3 rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-fg">{rule.name}</p>
          <p className="text-xs text-fg-muted">{accountLabel(account)}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${executing ? "bg-warning-tint text-warning" : "bg-muted text-muted-foreground"}`}>
            {executing ? "Executando na conta" : "Simulando"}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${rule.is_active ? "bg-success-tint text-success" : "bg-muted text-muted-foreground"}`}>
            {rule.is_active ? "Ligada" : "Desligada"}
          </span>
        </div>
      </div>
      <p className="text-sm text-text-secondary">{ruleSentence(rule)}</p>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" loading={test.isPending} onClick={() => test.mutate()}>
          <FlaskConical /> Testar agora
        </Button>
        <Button size="sm" variant="outline" loading={patch.isPending} onClick={() => patch.mutate({ isActive: !rule.is_active })}>
          {rule.is_active ? <Pause /> : <Play />} {rule.is_active ? "Desligar" : "Ligar"}
        </Button>
        {executing ? (
          <Button size="sm" variant="outline" onClick={() => patch.mutate({ mode: "simulate" })}>
            Voltar a simular
          </Button>
        ) : (
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              if (window.confirm(`A regra "${rule.name}" vai ${ACTIONS[rule.action] ?? rule.action} sozinha, direto na conta real do cliente. Confirmar?`)) {
                patch.mutate({ mode: "execute", confirmExecute: true });
              }
            }}
          >
            <ShieldAlert /> Passar a executar
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          loading={remove.isPending}
          onClick={() => {
            if (window.confirm(`Apagar a regra "${rule.name}"? O histórico dela também some.`)) remove.mutate();
          }}
        >
          <Trash2 /> Apagar
        </Button>
      </div>
      {tests && (
        <div className="rounded-md border border-border p-3 text-xs" aria-live="polite">
          <p className="mb-1 font-semibold text-fg">Com os números de agora, a regra faria:</p>
          {tests.length === 0 ? (
            <p className="text-fg-muted">Nada — nenhuma campanha bate a condição.</p>
          ) : (
            <ul className="space-y-1">
              {tests.map((t, i) => (
                <li key={i} className="text-text-secondary">
                  <span className="font-medium text-fg">{t.campaign}:</span> {t.description}
                  {t.skipped && <span className="text-fg-muted"> · não age: {t.skipped}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

function RunsTable({ runs }: { runs: Run[] }) {
  if (runs.length === 0) return <p className="mt-3 text-sm text-fg-muted">Nada ainda. As decisões aparecem aqui depois da primeira rodada.</p>;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-fg-muted">
            <th className="py-2 pr-3 font-semibold">Quando</th>
            <th className="py-2 pr-3 font-semibold">Regra</th>
            <th className="py-2 pr-3 font-semibold">Campanha</th>
            <th className="py-2 pr-3 font-semibold">Decisão</th>
            <th className="py-2 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id} className="border-b border-border align-top last:border-0">
              <td className="py-2 pr-3 text-xs tabular-nums text-fg-muted">
                {new Date(run.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </td>
              <td className="py-2 pr-3">{run.automation_rules?.name ?? "—"}</td>
              <td className="py-2 pr-3">{run.entity_name ?? "—"}</td>
              <td className="py-2 pr-3 text-xs text-text-secondary">{run.detail}</td>
              <td className="py-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS[run.status].className}`}>{STATUS[run.status].label}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AutomationsClient() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const data = useQuery({
    queryKey: ["automation", "rules"],
    queryFn: () => send<{ rules: Rule[]; accounts: Account[]; clients: Client[] }>("/api/automation/rules", "GET"),
  });
  const runs = useQuery({
    queryKey: ["automation", "runs"],
    queryFn: () => send<{ runs: Run[] }>("/api/automation/runs", "GET"),
  });
  const accountById = useMemo(() => new Map((data.data?.accounts ?? []).map((a) => [a.id, a])), [data.data]);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["automation"] });
  };

  if (data.isPending) return <div className="h-64 animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none" aria-busy="true" />;
  if (data.isError)
    return (
      <p role="alert" className="text-sm text-danger">
        {data.error.message}
      </p>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-text-secondary">
          As regras rodam de hora em hora, campanha por campanha. Cada ação real aparece também na Central de Histórico do cliente.
        </p>
        <Button onClick={() => setShowForm((v) => !v)} variant={showForm ? "outline" : "primary"}>
          <Plus /> {showForm ? "Fechar" : "Nova regra"}
        </Button>
      </div>

      {showForm && (
        <NewRuleForm
          accounts={data.data.accounts}
          clients={data.data.clients}
          onDone={() => {
            setShowForm(false);
            refresh();
          }}
        />
      )}

      {data.data.rules.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <Zap className="mx-auto text-primary" size={28} />
          <p className="mt-3 font-semibold text-fg">Nenhuma regra ainda</p>
          <p className="mt-1 text-sm text-text-secondary">Ex.: &ldquo;Se o CPA dos últimos 3 dias passar de R$ 50, pausar a campanha&rdquo;.</p>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {data.data.rules.map((rule) => (
            <RuleCard key={rule.id} rule={rule} account={accountById.get(rule.ad_account_id)} onChanged={refresh} />
          ))}
        </ul>
      )}

      <section className="rounded-lg border border-border bg-card p-4 md:p-5">
        <h2 className="font-display text-base font-semibold text-fg">Histórico das regras</h2>
        {runs.isError ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {runs.error.message}
          </p>
        ) : (
          <RunsTable runs={runs.data?.runs ?? []} />
        )}
      </section>
    </div>
  );
}
