import type {
  AdAccountOption,
  ClientOption,
  DeliveryStep,
  GenerateResult,
  PreviewResult,
  ReportDetail,
  ReportListItem,
  ReportPayload,
  ReportRun,
} from "./types";
import type { ReportPeriod } from "@/lib/reports/period";

interface ZodIssueLike {
  message?: string;
  path?: Array<string | number>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly issues: string[];

  constructor(status: number, message: string, issues: string[] = []) {
    super(message);
    this.status = status;
    this.issues = issues;
  }
}

const NETWORK_ERROR = "Sem conexão com o servidor. Verifique a internet e tente de novo.";

function issueText(issue: ZodIssueLike): string {
  const path = issue.path?.length ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message ?? "valor inválido"}`;
}

function readIssues(details: unknown): string[] {
  if (!Array.isArray(details)) return [];
  return details.filter((d): d is ZodIssueLike => typeof d === "object" && d !== null).map(issueText);
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new ApiError(0, NETWORK_ERROR);
  }

  const payload: unknown = await response.json().catch(() => null);
  const body = (payload ?? {}) as { data?: T; error?: string; details?: unknown };

  if (!response.ok) {
    throw new ApiError(response.status, body.error ?? `Erro ${response.status} ao falar com o servidor.`, readIssues(body.details));
  }
  return body.data as T;
}

const json = (value: unknown): RequestInit["body"] => JSON.stringify(value);

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError || err instanceof Error) return err.message;
  return "Erro inesperado.";
}

export const reportsApi = {
  list: (clientId: string | null) =>
    request<ReportListItem[]>(clientId ? `/api/reports?client_id=${encodeURIComponent(clientId)}` : "/api/reports"),

  get: (id: string) => request<ReportDetail>(`/api/reports/${id}`),

  create: (payload: ReportPayload) => request<ReportDetail>("/api/reports", { method: "POST", body: json(payload) }),

  update: (id: string, payload: ReportPayload) =>
    request<ReportDetail>(`/api/reports/${id}`, { method: "PATCH", body: json(payload) }),

  remove: (id: string) => request<unknown>(`/api/reports/${id}`, { method: "DELETE" }),

  runs: (id: string, limit = 30) => request<ReportRun[]>(`/api/reports/${id}/runs?limit=${limit}`),

  generate: (id: string) => request<GenerateResult>(`/api/reports/${id}/generate`, { method: "POST" }),

  deliver: (runId: string, step: DeliveryStep, note?: string) =>
    request<ReportRun>(`/api/report-runs/${runId}/delivery`, {
      method: "POST",
      body: json(note ? { step, note } : { step }),
    }),

  previewLive: (
    input: {
      body: string;
      period: ReportPeriod;
      customStart: string | null;
      customEnd: string | null;
      clientId: string;
      adAccountId: string | null;
      timezone: string;
    },
    signal?: AbortSignal,
  ) =>
    request<PreviewResult>("/api/reports/preview", {
      method: "POST",
      signal,
      body: json({
        body: input.body,
        mode: "live",
        period: input.period,
        customStart: input.period === "custom" ? input.customStart : undefined,
        customEnd: input.period === "custom" ? input.customEnd : undefined,
        clientId: input.clientId,
        adAccountId: input.adAccountId ?? undefined,
        timezone: input.timezone,
      }),
    }),

  clients: async (): Promise<ClientOption[]> => {
    const rows = await request<Array<{ id: string; name: string }> | undefined>("/api/clients");
    return (rows ?? []).map(({ id, name }) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  },

  accounts: async (clientId: string): Promise<AdAccountOption[]> => {
    const client = await request<{ ad_accounts?: AdAccountOption[] | null }>(`/api/clients/${clientId}`);
    return client.ad_accounts ?? [];
  },

  profileId: async (): Promise<string | null> => {
    const profile = await request<{ id?: string } | undefined>("/api/profile");
    return profile?.id ?? null;
  },
};

export const queryKeys = {
  reports: (clientId: string | null) => ["reports", "list", clientId ?? "all"] as const,
  reportsAll: ["reports"] as const,
  report: (id: string) => ["reports", "detail", id] as const,
  runs: (id: string) => ["reports", "runs", id] as const,
  clients: ["reports", "clients"] as const,
  accounts: (clientId: string) => ["reports", "accounts", clientId] as const,
  profile: ["reports", "profile"] as const,
};
