"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleAlert, KeyRound, LogIn, RefreshCw, Search, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui";
import { formatCustomerId } from "@/lib/google-ads/gaql";

type Checklist = {
  developerToken: boolean;
  loginCustomerId: string | null;
  serviceAccountEmail: string | null;
  serviceAccountError: string | null;
  oauthClient: boolean;
};

type GoogleAccount = {
  id: string;
  external_id: string;
  name: string | null;
  currency: string | null;
  status: string;
  client_id: string | null;
  last_synced_at: string | null;
};

type StatusResponse = {
  config: Checklist;
  connection: { mode: "service_account" | "oauth"; status: string; email: string | null; lastError: string | null; connectedAt: string } | null;
  accounts: GoogleAccount[];
  clients: Array<{ id: string; name: string }>;
};

type TestStep = { label: string; ok: boolean; detail: string };
type Action = "connect_service_account" | "test" | "discover" | "sync";

const STATUS_KEY = ["google-ads", "status"];

const FLASH_ERRORS: Record<string, string> = {
  oauth_denied: "O login Google foi cancelado.",
  missing_params: "O Google não devolveu a autorização. Tente de novo.",
  invalid_state: "A autorização expirou. Clique em Entrar com Google de novo.",
  unauthenticated: "Sua sessão no painel expirou. Entre de novo e reconecte.",
  save_failed: "Não foi possível salvar a conexão com o Google.",
  oauth_not_configured: "O login Google ainda não está configurado na Vercel (GOOGLE_ADS_CLIENT_ID e GOOGLE_ADS_CLIENT_SECRET).",
};

async function readJson<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Erro ${res.status}`);
  return body;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "nunca";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function actionMessage(action: Action, data: Record<string, unknown>): string {
  if (action === "sync") {
    const failed = (data.failed as Array<{ account: string; message: string }> | undefined) ?? [];
    const base = `${data.synced ?? 0} de ${data.accounts ?? 0} contas sincronizadas · ${data.campaigns ?? 0} campanhas · ${data.metricRows ?? 0} linhas de métricas`;
    const budget = data.stoppedByBudget ? " · o restante continua na sincronização automática" : "";
    const warnings = (data.warnings as string[] | undefined) ?? [];
    const warning = warnings.length ? ` Aviso: ${warnings[0]}` : "";
    return failed.length ? `${base}${budget}. Falhou: ${failed[0].account} — ${failed[0].message}${warning}` : `${base}${budget}.${warning}`;
  }
  return `${data.found ?? 0} contas encontradas no Google Ads, ${data.created ?? 0} novas no painel.`;
}

function CheckRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-2.5 py-1.5">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" /> : <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />}
      <div className="min-w-0">
        <p className="text-sm font-medium text-fg">{label}</p>
        <p className="break-words text-xs text-fg-muted">{detail}</p>
      </div>
    </li>
  );
}

export default function GoogleSettingsClient({ flashConnected, flashError }: { flashConnected: boolean; flashError?: string }) {
  const queryClient = useQueryClient();
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(
    flashConnected
      ? { tone: "ok", text: "Google conectado. As contas do MCC já aparecem abaixo." }
      : flashError
        ? { tone: "bad", text: FLASH_ERRORS[flashError] ?? "Não foi possível conectar o Google." }
        : null,
  );
  const [steps, setSteps] = useState<TestStep[] | null>(null);
  const [showHidden, setShowHidden] = useState(false);

  const status = useQuery({
    queryKey: STATUS_KEY,
    queryFn: async () => readJson<StatusResponse>(await fetch("/api/google-ads", { cache: "no-store" })),
  });

  const run = useMutation({
    mutationFn: async (action: Action) => ({
      action,
      data: await readJson<Record<string, unknown>>(
        await fetch("/api/google-ads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) }),
      ),
    }),
    onSuccess: ({ action, data }) => {
      if (action === "test") setSteps((data.steps as TestStep[]) ?? []);
      else setMessage({ tone: "ok", text: actionMessage(action, data) });
    },
    onError: (err) => setMessage({ tone: "bad", text: err instanceof Error ? err.message : "Erro inesperado." }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: STATUS_KEY }),
  });

  const patch = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: { status?: string; clientId?: string | null } }) =>
      readJson(
        await fetch(`/api/google-ads/accounts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
      ),
    onError: (err) => setMessage({ tone: "bad", text: err instanceof Error ? err.message : "Erro ao salvar a conta." }),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: STATUS_KEY }),
  });

  if (status.isPending) return <div className="h-64 animate-pulse rounded-lg bg-surface-2" aria-busy="true" aria-label="Carregando Google Ads" />;
  if (status.isError) {
    return (
      <div role="alert" className="rounded-lg border border-danger/30 bg-danger-tint p-5 text-sm text-danger">
        {status.error.message}{" "}
        <button type="button" className="underline" onClick={() => void status.refetch()}>
          Tentar de novo
        </button>
      </div>
    );
  }

  const { config, connection, accounts, clients } = status.data;
  const busy = run.isPending ? run.variables : null;
  const activeCount = accounts.filter((a) => a.status === "active").length;
  const visible = showHidden ? accounts : accounts.filter((a) => a.status === "active");

  return (
    <div className="space-y-6">
      {message && (
        <div
          role="status"
          className={`rounded-lg border p-3 text-sm ${message.tone === "ok" ? "border-success/30 bg-success-tint text-success" : "border-danger/30 bg-danger-tint text-danger"}`}
        >
          {message.text}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="rounded-lg border border-border bg-card p-4 md:p-5">
          <h2 className="font-display text-base font-semibold text-fg">Configuração</h2>
          <p className="mt-0.5 text-xs text-fg-muted">Variáveis lidas da Vercel. Os valores nunca aparecem aqui.</p>
          <ul className="mt-3 divide-y divide-border">
            <CheckRow ok={config.developerToken} label="Developer token" detail={config.developerToken ? "configurado" : "falta GOOGLE_ADS_DEVELOPER_TOKEN"} />
            <CheckRow
              ok={Boolean(config.loginCustomerId)}
              label="MCC (login-customer-id)"
              detail={config.loginCustomerId ? formatCustomerId(config.loginCustomerId) : "falta GOOGLE_ADS_LOGIN_CUSTOMER_ID"}
            />
            <CheckRow
              ok={Boolean(config.serviceAccountEmail)}
              label="Conta de serviço"
              detail={config.serviceAccountEmail ?? config.serviceAccountError ?? "falta GOOGLE_ADS_SERVICE_ACCOUNT_JSON (opcional se usar login Google)"}
            />
            <CheckRow
              ok={config.oauthClient}
              label="Login Google (OAuth)"
              detail={config.oauthClient ? "configurado" : "falta GOOGLE_ADS_CLIENT_ID / GOOGLE_ADS_CLIENT_SECRET (opcional)"}
            />
          </ul>
          {config.serviceAccountEmail && (
            <p className="mt-3 rounded-md bg-surface-2 p-3 text-xs text-fg-muted">
              No Google Ads do MCC, em Administrador → Acesso e segurança, adicione{" "}
              <span className="break-all font-mono text-fg">{config.serviceAccountEmail}</span> como usuário (acesso Padrão ou Somente leitura).
            </p>
          )}
        </section>

        <section className="rounded-lg border border-border bg-card p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-semibold text-fg">Conexão</h2>
              <p className="mt-0.5 text-xs text-fg-muted">
                {connection
                  ? `${connection.mode === "oauth" ? `Login Google${connection.email ? ` · ${connection.email}` : ""}` : "Conta de serviço"} · desde ${formatDateTime(connection.connectedAt)}`
                  : "Ainda não conectado"}
              </p>
            </div>
            {connection && (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${connection.status === "active" ? "bg-success-tint text-success" : "bg-warning-tint text-warning"}`}
              >
                {connection.status === "active" ? "Ativa" : connection.status === "expired" ? "Expirada" : "Com erro"}
              </span>
            )}
          </div>
          {connection?.lastError && (
            <p className="mt-3 flex gap-2 rounded-md bg-warning-tint p-3 text-xs text-warning">
              <CircleAlert className="size-4 shrink-0" /> {connection.lastError}
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant={connection ? "outline" : "primary"}
              disabled={!config.serviceAccountEmail || !config.developerToken}
              loading={busy === "connect_service_account"}
              onClick={() => run.mutate("connect_service_account")}
            >
              <KeyRound /> Conectar com conta de serviço
            </Button>
            {config.oauthClient ? (
              <Button asChild variant="outline">
                <a href="/api/google/oauth">
                  <LogIn /> Entrar com Google
                </a>
              </Button>
            ) : (
              <Button variant="outline" disabled title="Configure GOOGLE_ADS_CLIENT_ID e GOOGLE_ADS_CLIENT_SECRET">
                <LogIn /> Entrar com Google
              </Button>
            )}
            <Button variant="secondary" loading={busy === "test"} onClick={() => run.mutate("test")}>
              <ShieldCheck /> Testar conexão
            </Button>
          </div>

          {steps && (
            <div className="mt-4 rounded-md border border-border p-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Resultado do teste</p>
              <ul className="mt-1 divide-y divide-border">
                {steps.map((s) => (
                  <CheckRow key={s.label} ok={s.ok} label={s.label} detail={s.detail} />
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card p-4 md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-base font-semibold text-fg">Contas do Google Ads</h2>
            <p className="mt-0.5 text-xs text-fg-muted">
              {activeCount} no painel de {accounts.length} encontradas · sincronização automática a cada 3 horas
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={!connection} loading={busy === "discover"} onClick={() => run.mutate("discover")}>
              <Search /> Buscar contas
            </Button>
            <Button variant="primary" disabled={!connection || activeCount === 0} loading={busy === "sync"} onClick={() => run.mutate("sync")}>
              <RefreshCw /> Sincronizar agora ({activeCount})
            </Button>
          </div>
        </div>

        {accounts.length === 0 ? (
          <p className="mt-6 rounded-md bg-surface-2 p-6 text-center text-sm text-fg-muted">
            {connection ? "Nenhuma conta encontrada ainda. Clique em Buscar contas." : "Conecte o Google para listar as contas do MCC."}
          </p>
        ) : (
          <>
            <label className="mt-4 flex min-h-11 items-center gap-2 text-sm text-fg-muted lg:min-h-0">
              <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} className="size-4 accent-[var(--primary)]" />
              Mostrar contas fora do painel ({accounts.length - activeCount})
            </label>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-fg-muted">
                    <th className="py-2 pr-3 font-semibold">Conta</th>
                    <th className="py-2 pr-3 font-semibold">Cliente</th>
                    <th className="py-2 pr-3 font-semibold">Última sincronização</th>
                    <th className="py-2 font-semibold">No painel</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((account) => {
                    const label = account.name ?? formatCustomerId(account.external_id);
                    const isActive = account.status === "active";
                    return (
                      <tr key={account.id} className="border-b border-border last:border-0">
                        <td className="py-2.5 pr-3">
                          <p className="font-medium text-fg">{label}</p>
                          <p className="font-mono text-xs text-fg-muted">
                            {formatCustomerId(account.external_id)} · {account.currency ?? "BRL"}
                          </p>
                        </td>
                        <td className="py-2.5 pr-3">
                          <select
                            aria-label={`Cliente da conta ${label}`}
                            value={account.client_id ?? ""}
                            disabled={patch.isPending}
                            onChange={(e) => patch.mutate({ id: account.id, body: { clientId: e.target.value || null } })}
                            className="min-h-11 w-full max-w-[220px] rounded-md border border-border bg-input px-2 text-sm text-fg lg:min-h-8"
                          >
                            <option value="">Sem cliente</option>
                            {clients.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 pr-3 text-xs text-fg-muted">{formatDateTime(account.last_synced_at)}</td>
                        <td className="py-2.5">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isActive}
                            aria-label={`Mostrar ${label} no painel`}
                            disabled={patch.isPending}
                            onClick={() => patch.mutate({ id: account.id, body: { status: isActive ? "hidden" : "active" } })}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isActive ? "bg-primary" : "bg-border-strong"}`}
                          >
                            <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform ${isActive ? "translate-x-5" : "translate-x-0.5"}`} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
        {activeCount > 0 && (
          <p className="mt-4 text-xs text-fg-muted">
            Veja os números em{" "}
            <Link href="/google-ads" className="font-semibold text-primary hover:underline">
              Google Ads → Visão geral
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  );
}
