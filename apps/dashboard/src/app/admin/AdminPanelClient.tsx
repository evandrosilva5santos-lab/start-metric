"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type {
  AdminLogLevel,
  AdminPlan,
  AdminProblem,
  AdminProblemSeverity,
  AdminProblemStatus,
  AdminRevenueSnapshot,
  AdminUser,
  AdminUserRole,
  AdminUserLog,
} from "@/lib/admin/types";

type RevenueResponse = {
  snapshots: AdminRevenueSnapshot[];
  generated: boolean;
};

type ApiErrorBody = {
  error?: string;
};

const ROLE_OPTIONS: AdminUserRole[] = ["viewer", "analyst", "manager", "owner"];
const LOG_LEVEL_OPTIONS: AdminLogLevel[] = ["info", "warning", "error", "critical", "debug"];
const PROBLEM_SEVERITY_OPTIONS: AdminProblemSeverity[] = ["low", "medium", "high", "critical"];
const PROBLEM_STATUS_OPTIONS: AdminProblemStatus[] = ["open", "investigating", "resolved", "ignored"];

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  const json = (await response.json().catch(() => ({}))) as ApiErrorBody & T;

  if (!response.ok) {
    throw new Error(json.error ?? `Falha ao acessar ${url}`);
  }

  return json;
}

function formatCurrency(value: number | null | undefined): string {
  const amount = typeof value === "number" ? value : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(date);
}

export default function AdminPanelClient() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<AdminUserLog[]>([]);
  const [problems, setProblems] = useState<AdminProblem[]>([]);
  const [revenue, setRevenue] = useState<AdminRevenueSnapshot[]>([]);
  const [generatedRevenue, setGeneratedRevenue] = useState(false);

  const [planForm, setPlanForm] = useState({
    code: "",
    name: "",
    status: "draft",
    description: "",
    priceMonthlyMock: "",
    priceYearlyMock: "",
  });

  const [userForm, setUserForm] = useState({
    email: "",
    name: "",
    phone: "",
    password: "",
    role: "viewer",
    planId: "",
  });

  const [logForm, setLogForm] = useState({
    userId: "",
    level: "info",
    event: "",
    errorCode: "",
    errorMessage: "",
    rootCause: "",
    detailedAnalysis: "",
    contextJsonText: "",
    source: "admin_panel",
  });

  const [problemForm, setProblemForm] = useState({
    userId: "",
    logId: "",
    title: "",
    severity: "medium",
    status: "open",
    symptom: "",
    rootCause: "",
    detailedAnalysis: "",
    impact: "",
  });

  const [revenueForm, setRevenueForm] = useState({
    snapshotDate: new Date().toISOString().slice(0, 10),
    mrr: "",
    arr: "",
    churnRate: "",
    newCustomers: "",
    notes: "",
  });

  const loadPlans = useCallback(async () => {
    const response = await requestJson<{ plans: AdminPlan[] }>("/api/admin/plans", { method: "GET" });
    setPlans(response.plans ?? []);
  }, []);

  const loadUsers = useCallback(async () => {
    const response = await requestJson<{ users: AdminUser[] }>("/api/admin/users", { method: "GET" });
    setUsers(response.users ?? []);
  }, []);

  const loadLogs = useCallback(async () => {
    const response = await requestJson<{ logs: AdminUserLog[] }>("/api/admin/logs?limit=40", { method: "GET" });
    setLogs(response.logs ?? []);
  }, []);

  const loadProblems = useCallback(async () => {
    const response = await requestJson<{ problems: AdminProblem[] }>("/api/admin/problems?limit=40", {
      method: "GET",
    });
    setProblems(response.problems ?? []);
  }, []);

  const loadRevenue = useCallback(async () => {
    const response = await requestJson<RevenueResponse>("/api/admin/revenue", { method: "GET" });
    setRevenue(response.snapshots ?? []);
    setGeneratedRevenue(Boolean(response.generated));
  }, []);

  const refreshAll = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) {
        setRefreshing(true);
      }
      setError(null);

      try {
        await Promise.all([loadPlans(), loadUsers(), loadLogs(), loadProblems(), loadRevenue()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Falha ao carregar painel admin.");
      } finally {
        if (showSpinner) {
          setRefreshing(false);
        }
      }
    },
    [loadLogs, loadPlans, loadProblems, loadRevenue, loadUsers],
  );

  useEffect(() => {
    let active = true;

    const run = async () => {
      setLoading(true);
      await refreshAll(false);
      if (active) {
        setLoading(false);
      }
    };

    void run();

    return () => {
      active = false;
    };
  }, [refreshAll]);

  const latestRevenue = useMemo(() => {
    if (revenue.length === 0) return null;
    return revenue[revenue.length - 1] ?? null;
  }, [revenue]);

  const openProblemsCount = useMemo(
    () => problems.filter((problem) => problem.status === "open" || problem.status === "investigating").length,
    [problems],
  );

  async function handleCreatePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);
    setSubmitting("plan");

    try {
      await requestJson<{ plan: AdminPlan }>("/api/admin/plans", {
        method: "POST",
        body: JSON.stringify({
          code: planForm.code,
          name: planForm.name,
          status: planForm.status,
          description: planForm.description,
          priceMonthlyMock: planForm.priceMonthlyMock,
          priceYearlyMock: planForm.priceYearlyMock,
        }),
      });

      setPlanForm({
        code: "",
        name: "",
        status: "draft",
        description: "",
        priceMonthlyMock: "",
        priceYearlyMock: "",
      });
      setNotice("Plano adicionado com sucesso.");
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar plano.");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);
    setSubmitting("user");

    try {
      await requestJson<{ user: AdminUser }>("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: userForm.email,
          name: userForm.name,
          phone: userForm.phone,
          password: userForm.password,
          role: userForm.role,
          planId: userForm.planId || null,
        }),
      });

      setUserForm({
        email: "",
        name: "",
        phone: "",
        password: "",
        role: "viewer",
        planId: "",
      });
      setNotice("Usuário criado e vinculado à organização.");
      await Promise.all([loadUsers(), loadLogs()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar usuário.");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleCreateLog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);
    setSubmitting("log");

    let contextJson: Record<string, unknown> = {};
    if (logForm.contextJsonText.trim()) {
      try {
        const parsed = JSON.parse(logForm.contextJsonText) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          contextJson = parsed as Record<string, unknown>;
        } else {
          throw new Error("contextJson precisa ser um objeto JSON");
        }
      } catch {
        setSubmitting(null);
        setError("contextJson inválido. Use JSON de objeto, por exemplo: {\"step\":\"auth\"}");
        return;
      }
    }

    try {
      await requestJson<{ log: AdminUserLog }>("/api/admin/logs", {
        method: "POST",
        body: JSON.stringify({
          userId: logForm.userId || null,
          level: logForm.level,
          event: logForm.event,
          errorCode: logForm.errorCode,
          errorMessage: logForm.errorMessage,
          rootCause: logForm.rootCause,
          detailedAnalysis: logForm.detailedAnalysis,
          contextJson,
          source: logForm.source,
        }),
      });

      setLogForm({
        userId: "",
        level: "info",
        event: "",
        errorCode: "",
        errorMessage: "",
        rootCause: "",
        detailedAnalysis: "",
        contextJsonText: "",
        source: "admin_panel",
      });
      setNotice("Log técnico registrado com sucesso.");
      await loadLogs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao registrar log.");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleCreateProblem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);
    setSubmitting("problem");

    try {
      await requestJson<{ problem: AdminProblem }>("/api/admin/problems", {
        method: "POST",
        body: JSON.stringify({
          userId: problemForm.userId || null,
          logId: problemForm.logId || null,
          title: problemForm.title,
          severity: problemForm.severity,
          status: problemForm.status,
          symptom: problemForm.symptom,
          rootCause: problemForm.rootCause,
          detailedAnalysis: problemForm.detailedAnalysis,
          impact: problemForm.impact,
        }),
      });

      setProblemForm({
        userId: "",
        logId: "",
        title: "",
        severity: "medium",
        status: "open",
        symptom: "",
        rootCause: "",
        detailedAnalysis: "",
        impact: "",
      });
      setNotice("Problema registrado no backlog técnico.");
      await Promise.all([loadProblems(), loadLogs()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao criar problema.");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleUpdateProblemStatus(problemId: string, nextStatus: AdminProblemStatus) {
    setNotice(null);
    setError(null);
    setSubmitting(`problem-status-${problemId}`);

    try {
      await requestJson<{ problem: AdminProblem }>(`/api/admin/problems/${problemId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setNotice(`Status atualizado para ${nextStatus}.`);
      await Promise.all([loadProblems(), loadLogs()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao atualizar status do problema.");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleCreateRevenueSnapshot(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    setError(null);
    setSubmitting("revenue");

    try {
      await requestJson<{ snapshot: AdminRevenueSnapshot }>("/api/admin/revenue", {
        method: "POST",
        body: JSON.stringify({
          snapshotDate: revenueForm.snapshotDate,
          mrr: revenueForm.mrr,
          arr: revenueForm.arr,
          churnRate: revenueForm.churnRate,
          newCustomers: revenueForm.newCustomers,
          notes: revenueForm.notes,
        }),
      });

      setRevenueForm((prev) => ({
        ...prev,
        mrr: "",
        arr: "",
        churnRate: "",
        newCustomers: "",
        notes: "",
      }));
      setNotice("Snapshot de receita salvo (mock).");
      await loadRevenue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar snapshot de receita.");
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <main className="flex-1 p-6 lg:p-8 overflow-y-auto min-w-0">
        <div className="glass rounded-3xl p-8 border border-primary/20">
          <h1 className="text-2xl font-black text-fg">Painel Admin</h1>
          <p className="text-sm text-fg-muted mt-2">Carregando dados administrativos...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-w-0 space-y-6">
      <section className="glass glass-2 rounded-3xl p-6 lg:p-8 border border-primary/20">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-primary font-semibold">Admin Control Center</p>
            <h1 className="text-3xl font-black text-fg tracking-tight mt-1">Gestão operacional do SaaS</h1>
            <p className="text-sm text-fg-muted mt-2 max-w-3xl">
              Área para adicionar planos mock, criar usuários reais, documentar logs técnicos e registrar
              problemas minuciosamente.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void refreshAll(true)}
            disabled={refreshing}
            className="px-4 py-2 rounded-xl border border-primary/30 text-primary text-xs font-bold uppercase tracking-[0.16em] hover:bg-primary-tint transition disabled:opacity-60"
          >
            {refreshing ? "Atualizando..." : "Atualizar Painel"}
          </button>
        </div>

        {(error || notice) && (
          <div className="mt-5 space-y-2">
            {error && <p className="text-sm rounded-xl border border-danger/30 bg-danger-tint px-4 py-3 text-danger">{error}</p>}
            {notice && <p className="text-sm rounded-xl border border-success/30 bg-success-tint px-4 py-3 text-success">{notice}</p>}
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <article className="glass rounded-2xl p-4 border border-border">
            <p className="text-[11px] uppercase tracking-[0.18em] text-fg-muted">Usuários</p>
            <p className="text-3xl font-black text-fg mt-1">{users.length}</p>
            <p className="text-xs text-fg-muted mt-1">Cadastrados na organização</p>
          </article>

          <article className="glass rounded-2xl p-4 border border-border">
            <p className="text-[11px] uppercase tracking-[0.18em] text-fg-muted">Planos</p>
            <p className="text-3xl font-black text-fg mt-1">{plans.length}</p>
            <p className="text-xs text-fg-muted mt-1">Mock + em elaboração</p>
          </article>

          <article className="glass rounded-2xl p-4 border border-border">
            <p className="text-[11px] uppercase tracking-[0.18em] text-fg-muted">Incidentes Abertos</p>
            <p className="text-3xl font-black text-warning mt-1">{openProblemsCount}</p>
            <p className="text-xs text-fg-muted mt-1">Open + investigating</p>
          </article>

          <article className="glass rounded-2xl p-4 border border-border">
            <p className="text-[11px] uppercase tracking-[0.18em] text-fg-muted">MRR (mock)</p>
            <p className="text-3xl font-black text-primary mt-1">{formatCurrency(latestRevenue?.mrr ?? 0)}</p>
            <p className="text-xs text-fg-muted mt-1">Base: {latestRevenue ? formatDateOnly(latestRevenue.snapshot_date) : "-"}</p>
          </article>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <article className="glass rounded-3xl p-6 border border-border">
          <h2 className="text-xl font-black text-fg tracking-tight">Adicionar plano (fictício)</h2>
          <p className="text-sm text-fg-muted mt-1">Use para testar pricing/entitlements antes da versão comercial.</p>

          <form onSubmit={handleCreatePlan} className="mt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={planForm.name}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nome do plano"
                className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
                required
              />
              <input
                value={planForm.code}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, code: event.target.value }))}
                placeholder="Código (opcional)"
                className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="number"
                step="0.01"
                min="0"
                value={planForm.priceMonthlyMock}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, priceMonthlyMock: event.target.value }))}
                placeholder="Preço mensal"
                className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              />
              <input
                type="number"
                step="0.01"
                min="0"
                value={planForm.priceYearlyMock}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, priceYearlyMock: event.target.value }))}
                placeholder="Preço anual"
                className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              />
              <select
                value={planForm.status}
                onChange={(event) => setPlanForm((prev) => ({ ...prev, status: event.target.value }))}
                className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              >
                <option value="draft">draft</option>
                <option value="active">active</option>
                <option value="archived">archived</option>
              </select>
            </div>

            <textarea
              value={planForm.description}
              onChange={(event) => setPlanForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Descrição / escopo do plano"
              className="w-full min-h-20 rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
            />

            <button
              type="submit"
              disabled={submitting === "plan"}
              className="rounded-xl border border-primary/40 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-primary hover:bg-primary-tint transition disabled:opacity-60"
            >
              {submitting === "plan" ? "Salvando..." : "Adicionar plano"}
            </button>
          </form>

          <div className="mt-5 space-y-2 max-h-56 overflow-auto pr-1">
            {plans.length === 0 && <p className="text-sm text-fg-muted">Nenhum plano cadastrado.</p>}
            {plans.map((plan) => (
              <div key={plan.id} className="rounded-xl border border-border bg-surface px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-fg">{plan.name}</p>
                  <span className="text-[10px] uppercase tracking-[0.15em] text-primary">{plan.status}</span>
                </div>
                <p className="text-xs text-fg-muted mt-1">
                  {plan.code} • {formatCurrency(plan.price_monthly_mock)} / mês • {plan.subscription_count ?? 0} usuários
                </p>
              </div>
            ))}
          </div>
        </article>

        <article className="glass rounded-3xl p-6 border border-border">
          <h2 className="text-xl font-black text-fg tracking-tight">Criar usuário real</h2>
          <p className="text-sm text-fg-muted mt-1">Cria usuário no Auth e vincula ao org + plano opcional.</p>

          <form onSubmit={handleCreateUser} className="mt-4 space-y-3">
            <input
              type="email"
              value={userForm.email}
              onChange={(event) => setUserForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="E-mail"
              className="w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              required
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={userForm.name}
                onChange={(event) => setUserForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nome"
                className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              />
              <input
                value={userForm.phone}
                onChange={(event) => setUserForm((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="Telefone"
                className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={userForm.role}
                onChange={(event) => setUserForm((prev) => ({ ...prev, role: event.target.value }))}
                className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>

              <select
                value={userForm.planId}
                onChange={(event) => setUserForm((prev) => ({ ...prev, planId: event.target.value }))}
                className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              >
                <option value="">Sem plano</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name}
                  </option>
                ))}
              </select>

              <input
                type="password"
                value={userForm.password}
                onChange={(event) => setUserForm((prev) => ({ ...prev, password: event.target.value }))}
                placeholder="Senha (opcional)"
                className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              />
            </div>

            <button
              type="submit"
              disabled={submitting === "user"}
              className="rounded-xl border border-success/40 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-success hover:bg-success-tint transition disabled:opacity-60"
            >
              {submitting === "user" ? "Criando..." : "Criar usuário"}
            </button>
          </form>

          <div className="mt-5 max-h-56 overflow-auto pr-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-fg-muted text-xs uppercase tracking-[0.12em]">
                  <th className="text-left pb-2">Usuário</th>
                  <th className="text-left pb-2">Role</th>
                  <th className="text-left pb-2">Plano</th>
                </tr>
              </thead>
              <tbody className="text-fg">
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-border">
                    <td className="py-2 pr-2">
                      <p className="font-medium text-fg">{user.name ?? "Sem nome"}</p>
                      <p className="text-xs text-fg-muted">{user.email ?? user.id}</p>
                    </td>
                    <td className="py-2 pr-2">{user.role}</td>
                    <td className="py-2">{user.subscription?.plan_name ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <article className="glass rounded-3xl p-6 border border-border">
          <h2 className="text-xl font-black text-fg tracking-tight">Registrar log técnico</h2>
          <p className="text-sm text-fg-muted mt-1">Log estruturado por usuário, causa raiz e análise detalhada.</p>

          <form onSubmit={handleCreateLog} className="mt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={logForm.userId}
                onChange={(event) => setLogForm((prev) => ({ ...prev, userId: event.target.value }))}
                className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              >
                <option value="">Usuário atual</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name ?? user.email ?? user.id}
                  </option>
                ))}
              </select>

              <select
                value={logForm.level}
                onChange={(event) => setLogForm((prev) => ({ ...prev, level: event.target.value }))}
                className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              >
                {LOG_LEVEL_OPTIONS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>

              <input
                value={logForm.source}
                onChange={(event) => setLogForm((prev) => ({ ...prev, source: event.target.value }))}
                placeholder="source"
                className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              />
            </div>

            <input
              value={logForm.event}
              onChange={(event) => setLogForm((prev) => ({ ...prev, event: event.target.value }))}
              placeholder="event (ex: auth_loop_detected)"
              className="w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                value={logForm.errorCode}
                onChange={(event) => setLogForm((prev) => ({ ...prev, errorCode: event.target.value }))}
                placeholder="error_code"
                className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              />
              <input
                value={logForm.errorMessage}
                onChange={(event) => setLogForm((prev) => ({ ...prev, errorMessage: event.target.value }))}
                placeholder="error_message"
                className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              />
            </div>

            <textarea
              value={logForm.rootCause}
              onChange={(event) => setLogForm((prev) => ({ ...prev, rootCause: event.target.value }))}
              placeholder="Causa raiz (obrigatório)"
              className="w-full min-h-20 rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              required
            />

            <textarea
              value={logForm.detailedAnalysis}
              onChange={(event) => setLogForm((prev) => ({ ...prev, detailedAnalysis: event.target.value }))}
              placeholder="Análise detalhada"
              className="w-full min-h-24 rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
            />

            <textarea
              value={logForm.contextJsonText}
              onChange={(event) => setLogForm((prev) => ({ ...prev, contextJsonText: event.target.value }))}
              placeholder='contextJson (opcional) ex: {"route":"/auth"}'
              className="w-full min-h-20 rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg font-mono"
            />

            <button
              type="submit"
              disabled={submitting === "log"}
              className="rounded-xl border border-client/40 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-client hover:bg-client-tint transition disabled:opacity-60"
            >
              {submitting === "log" ? "Registrando..." : "Registrar log"}
            </button>
          </form>
        </article>

        <article className="glass rounded-3xl p-6 border border-border">
          <h2 className="text-xl font-black text-fg tracking-tight">Registrar problema</h2>
          <p className="text-sm text-fg-muted mt-1">Cadastro detalhado para investigação e histórico de resolução.</p>

          <form onSubmit={handleCreateProblem} className="mt-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={problemForm.userId}
                onChange={(event) => setProblemForm((prev) => ({ ...prev, userId: event.target.value }))}
                className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              >
                <option value="">Usuário (opcional)</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name ?? user.email ?? user.id}
                  </option>
                ))}
              </select>

              <select
                value={problemForm.severity}
                onChange={(event) => setProblemForm((prev) => ({ ...prev, severity: event.target.value }))}
                className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              >
                {PROBLEM_SEVERITY_OPTIONS.map((severity) => (
                  <option key={severity} value={severity}>
                    {severity}
                  </option>
                ))}
              </select>

              <select
                value={problemForm.status}
                onChange={(event) => setProblemForm((prev) => ({ ...prev, status: event.target.value }))}
                className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              >
                {PROBLEM_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <select
              value={problemForm.logId}
              onChange={(event) => setProblemForm((prev) => ({ ...prev, logId: event.target.value }))}
              className="w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
            >
              <option value="">Vincular a log (opcional)</option>
              {logs.map((log) => (
                <option key={log.id} value={log.id}>
                  [{log.level}] {log.event} - {formatDate(log.created_at)}
                </option>
              ))}
            </select>

            <input
              value={problemForm.title}
              onChange={(event) => setProblemForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Título do problema"
              className="w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              required
            />

            <textarea
              value={problemForm.symptom}
              onChange={(event) => setProblemForm((prev) => ({ ...prev, symptom: event.target.value }))}
              placeholder="Sintoma observado"
              className="w-full min-h-16 rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              required
            />

            <textarea
              value={problemForm.rootCause}
              onChange={(event) => setProblemForm((prev) => ({ ...prev, rootCause: event.target.value }))}
              placeholder="Causa raiz"
              className="w-full min-h-16 rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              required
            />

            <textarea
              value={problemForm.detailedAnalysis}
              onChange={(event) => setProblemForm((prev) => ({ ...prev, detailedAnalysis: event.target.value }))}
              placeholder="Análise minuciosa"
              className="w-full min-h-20 rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              required
            />

            <textarea
              value={problemForm.impact}
              onChange={(event) => setProblemForm((prev) => ({ ...prev, impact: event.target.value }))}
              placeholder="Impacto no usuário/negócio"
              className="w-full min-h-16 rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              required
            />

            <button
              type="submit"
              disabled={submitting === "problem"}
              className="rounded-xl border border-warning/40 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-warning hover:bg-warning-tint transition disabled:opacity-60"
            >
              {submitting === "problem" ? "Salvando..." : "Registrar problema"}
            </button>
          </form>
        </article>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <article className="glass rounded-3xl p-6 border border-border">
          <h2 className="text-xl font-black text-fg tracking-tight">Receita (mock)</h2>
          <p className="text-sm text-fg-muted mt-1">
            Dashboard fictício para validação de produto.
            {generatedRevenue ? " Dados atuais são gerados automaticamente por fallback." : " Dados vêm de snapshots salvos."}
          </p>

          <form onSubmit={handleCreateRevenueSnapshot} className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="date"
              value={revenueForm.snapshotDate}
              onChange={(event) => setRevenueForm((prev) => ({ ...prev, snapshotDate: event.target.value }))}
              className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              required
            />

            <input
              type="number"
              min="0"
              step="0.01"
              value={revenueForm.mrr}
              onChange={(event) => setRevenueForm((prev) => ({ ...prev, mrr: event.target.value }))}
              placeholder="MRR"
              className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
              required
            />

            <input
              type="number"
              min="0"
              step="0.01"
              value={revenueForm.arr}
              onChange={(event) => setRevenueForm((prev) => ({ ...prev, arr: event.target.value }))}
              placeholder="ARR (opcional)"
              className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
            />

            <input
              type="number"
              min="0"
              step="0.01"
              value={revenueForm.churnRate}
              onChange={(event) => setRevenueForm((prev) => ({ ...prev, churnRate: event.target.value }))}
              placeholder="Churn %"
              className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
            />

            <input
              type="number"
              min="0"
              value={revenueForm.newCustomers}
              onChange={(event) => setRevenueForm((prev) => ({ ...prev, newCustomers: event.target.value }))}
              placeholder="Novos clientes"
              className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
            />

            <input
              value={revenueForm.notes}
              onChange={(event) => setRevenueForm((prev) => ({ ...prev, notes: event.target.value }))}
              placeholder="Notas"
              className="rounded-xl bg-surface border border-border px-3 py-2 text-sm text-fg"
            />

            <button
              type="submit"
              disabled={submitting === "revenue"}
              className="sm:col-span-2 rounded-xl border border-primary/40 px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-primary hover:bg-primary-tint transition disabled:opacity-60"
            >
              {submitting === "revenue" ? "Salvando..." : "Salvar snapshot"}
            </button>
          </form>

          <div className="mt-5 max-h-64 overflow-auto pr-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-fg-muted text-xs uppercase tracking-[0.12em]">
                  <th className="text-left pb-2">Data</th>
                  <th className="text-left pb-2">MRR</th>
                  <th className="text-left pb-2">ARR</th>
                  <th className="text-left pb-2">Churn</th>
                </tr>
              </thead>
              <tbody>
                {revenue.map((snapshot) => (
                  <tr key={snapshot.id} className="border-t border-border text-fg">
                    <td className="py-2 pr-2">{formatDateOnly(snapshot.snapshot_date)}</td>
                    <td className="py-2 pr-2">{formatCurrency(snapshot.mrr)}</td>
                    <td className="py-2 pr-2">{formatCurrency(snapshot.arr)}</td>
                    <td className="py-2">{snapshot.churn_rate.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>

        <article className="glass rounded-3xl p-6 border border-border">
          <h2 className="text-xl font-black text-fg tracking-tight">Backlog de problemas</h2>
          <p className="text-sm text-fg-muted mt-1">Use os botões para avançar o status de investigação.</p>

          <div className="mt-4 space-y-3 max-h-[420px] overflow-auto pr-1">
            {problems.length === 0 && <p className="text-sm text-fg-muted">Nenhum problema registrado ainda.</p>}

            {problems.map((problem) => {
              const statusButton =
                problem.status === "open"
                  ? "investigating"
                  : problem.status === "investigating"
                    ? "resolved"
                    : null;

              return (
                <div key={problem.id} className="rounded-2xl border border-border bg-surface p-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-fg">{problem.title}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-[0.16em] rounded-full border border-border px-2 py-1 text-fg">
                        {problem.severity}
                      </span>
                      <span className="text-[10px] uppercase tracking-[0.16em] rounded-full border border-primary/30 px-2 py-1 text-primary">
                        {problem.status}
                      </span>
                    </div>
                  </div>

                  <p className="text-sm text-fg">
                    <span className="text-fg-muted">Sintoma:</span> {problem.symptom}
                  </p>
                  <p className="text-sm text-fg">
                    <span className="text-fg-muted">Causa raiz:</span> {problem.root_cause}
                  </p>
                  <p className="text-xs text-fg-muted">Atualizado em {formatDate(problem.updated_at)}</p>

                  {statusButton && (
                    <button
                      type="button"
                      onClick={() => void handleUpdateProblemStatus(problem.id, statusButton)}
                      disabled={submitting === `problem-status-${problem.id}`}
                      className="rounded-lg border border-primary/30 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.14em] text-primary hover:bg-primary-tint transition disabled:opacity-60"
                    >
                      {submitting === `problem-status-${problem.id}`
                        ? "Atualizando..."
                        : `Mover para ${statusButton}`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </article>
      </section>

      <section className="glass rounded-3xl p-6 border border-border">
        <h2 className="text-xl font-black text-fg tracking-tight">Últimos logs técnicos</h2>
        <p className="text-sm text-fg-muted mt-1">Registros de operação por usuário e ações administrativas.</p>

        <div className="mt-4 max-h-96 overflow-auto">
          <table className="w-full text-sm min-w-[880px]">
            <thead>
              <tr className="text-fg-muted text-xs uppercase tracking-[0.12em]">
                <th className="text-left pb-2">Quando</th>
                <th className="text-left pb-2">Nível</th>
                <th className="text-left pb-2">Evento</th>
                <th className="text-left pb-2">Usuário</th>
                <th className="text-left pb-2">Causa raiz</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-t border-border align-top">
                  <td className="py-2 pr-2 text-fg-muted">{formatDate(log.created_at)}</td>
                  <td className="py-2 pr-2 text-primary">{log.level}</td>
                  <td className="py-2 pr-2 text-fg">{log.event}</td>
                  <td className="py-2 pr-2 text-fg">{log.user_name ?? "-"}</td>
                  <td className="py-2 text-fg">{log.root_cause}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
