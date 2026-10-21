import { aggregateDailyMetrics, mergeMetrics, type DailyMetricRow, type MetricValues } from "./engine/metrics";
import { renderTemplate, type CreativeRow } from "./engine/render";
import { resolvePeriod, type PeriodInput, type ReportPeriod } from "./period";

export interface DateRange {
  since: string;
  until: string;
}

export interface AccountInfo {
  id: string;
  externalId: string;
  clientId: string | null;
  platform: string;
  currency: string | null;
}

export interface PartInput {
  position: number;
  adAccountId: string | null;
  period: ReportPeriod;
  customStart: string | null;
  customEnd: string | null;
  body: string;
  sendWithoutData: boolean;
}

export interface ReportInput {
  id: string;
  clientId: string;
  clientName: string | null;
  timezone: string;
  parts: readonly PartInput[];
}

export interface PartDataSource {
  loadDailyRows(accountIds: readonly string[], range: DateRange): Promise<DailyMetricRow[]>;
  loadInsightMetrics(account: AccountInfo, range: DateRange): Promise<MetricValues>;
  loadTopCreatives(account: AccountInfo, range: DateRange): Promise<CreativeRow[]>;
}

export interface RenderPartInput {
  body: string;
  period: PeriodInput;
  accounts: readonly AccountInfo[];
  clientName: string | null;
  timezone: string;
  now: Date;
  sendWithoutData: boolean;
}

export interface RenderPartResult {
  text: string;
  missing: string[];
  skipped: boolean;
  warnings: string[];
}

export type InsertRunResult = { inserted: true; runId: string } | { inserted: false };

export type FinalRunStatus = "generated" | "skipped" | "failed";

export interface RunPatch {
  status: FinalRunStatus;
  renderedBody: string | null;
  missing: string[];
  errorMessage: string | null;
}

export interface GenerationStore extends PartDataSource {
  insertRun(): Promise<InsertRunResult>;
  loadReport(): Promise<ReportInput | null>;
  loadAccounts(report: ReportInput): Promise<AccountInfo[]>;
  finishRun(runId: string, patch: RunPatch): Promise<void>;
}

export type GenerationResult =
  | { skipped: true }
  | { skipped: false; runId: string; status: FinalRunStatus; renderedBody: string | null; missing: string[]; warnings: string[] };

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
const ACCOUNT_INSIGHT_SLUG = /^meta_(reach|frequency|video_)/;
const CREATIVE_RANKING_SLUG = /^meta_(top_\d+|all)_creatives_ranking$/;
const MAX_ERROR_LENGTH = 1000;
const NO_DATA_MESSAGE = "Sem dados no período para nenhuma parte.";

export function templateNeeds(body: string): { accountInsights: boolean; creatives: boolean } {
  const slugs = [...body.matchAll(PLACEHOLDER)].map((m) => m[1]);
  return {
    accountInsights: slugs.some((s) => ACCOUNT_INSIGHT_SLUG.test(s)),
    creatives: slugs.some((s) => CREATIVE_RANKING_SLUG.test(s)),
  };
}

export function redactSecrets(message: string): string {
  return message
    .replace(/access_token=[^&\s"']+/gi, "access_token=[redacted]")
    .replace(/\bEAA[A-Za-z0-9]{20,}/g, "[redacted]")
    .slice(0, MAX_ERROR_LENGTH);
}

export function errorMessage(err: unknown): string {
  return redactSecrets(err instanceof Error ? err.message : String(err));
}

export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "23505";
}

export function selectPartAccounts(
  adAccountId: string | null,
  clientId: string,
  accounts: readonly AccountInfo[],
): AccountInfo[] {
  if (adAccountId) {
    return accounts.filter((account) => account.id === adAccountId && account.clientId === clientId);
  }
  return accounts.filter((account) => account.clientId === clientId);
}

interface LiveData {
  metrics: MetricValues;
  creatives: CreativeRow[];
  warnings: string[];
}

async function attempt<T>(label: string, load: () => Promise<T>, warnings: string[]): Promise<T | null> {
  try {
    return await load();
  } catch (err) {
    warnings.push(`${label}: ${errorMessage(err)}`);
    return null;
  }
}

async function loadLiveData(
  body: string,
  accounts: readonly AccountInfo[],
  range: DateRange,
  source: PartDataSource,
): Promise<LiveData> {
  const needs = templateNeeds(body);
  const warnings: string[] = [];
  if (!needs.accountInsights && !needs.creatives) return { metrics: {}, creatives: [], warnings };

  const metaAccounts = accounts.filter((a) => a.platform === "meta");
  if (metaAccounts.length !== 1) {
    warnings.push(
      `Alcance, frequência, vídeo e ranking de criativos exigem uma única conta Meta; a parte usa ${metaAccounts.length} contas.`,
    );
    return { metrics: {}, creatives: [], warnings };
  }

  const [account] = metaAccounts;
  const [metrics, creatives] = await Promise.all([
    needs.accountInsights ? attempt("Insights da Meta indisponível", () => source.loadInsightMetrics(account, range), warnings) : null,
    needs.creatives ? attempt("Ranking de criativos indisponível", () => source.loadTopCreatives(account, range), warnings) : null,
  ]);
  return { metrics: metrics ?? {}, creatives: creatives ?? [], warnings };
}

export async function renderLivePart(input: RenderPartInput, source: PartDataSource): Promise<RenderPartResult> {
  const period = resolvePeriod(input.period, input.now, input.timezone);
  const range = { since: period.since, until: period.until };
  const accountIds = input.accounts.map((a) => a.id);
  const rows = accountIds.length > 0 ? await source.loadDailyRows(accountIds, range) : [];

  if (rows.length === 0 && !input.sendWithoutData) {
    return { text: "", missing: [], skipped: true, warnings: [] };
  }

  const live = await loadLiveData(input.body, input.accounts, range, source);
  const { text, missing } = renderTemplate(
    input.body,
    {
      clientName: input.clientName ?? undefined,
      startDate: period.startDate,
      endDate: period.endDate,
      metrics: mergeMetrics(aggregateDailyMetrics(rows), live.metrics),
      creatives: live.creatives,
      currency: input.accounts[0]?.currency ?? undefined,
      timezone: input.timezone,
      now: input.now,
    },
    "live",
  );
  return { text, missing, skipped: false, warnings: live.warnings };
}

function unionMissing(results: readonly RenderPartResult[]): string[] {
  return [...new Set(results.flatMap((r) => r.missing))];
}

async function renderReport(report: ReportInput, store: GenerationStore, now: Date): Promise<RunPatch & { warnings: string[] }> {
  const accounts = await store.loadAccounts(report);
  const ordered = [...report.parts].sort((a, b) => a.position - b.position);
  const results: RenderPartResult[] = [];
  for (const part of ordered) {
    results.push(
      await renderLivePart(
        {
          body: part.body,
          period: { period: part.period, customStart: part.customStart, customEnd: part.customEnd },
          accounts: selectPartAccounts(part.adAccountId, report.clientId, accounts),
          clientName: report.clientName,
          timezone: report.timezone,
          now,
          sendWithoutData: part.sendWithoutData,
        },
        store,
      ),
    );
  }

  const rendered = results.filter((r) => !r.skipped);
  const warnings = results.flatMap((r) => r.warnings);
  if (rendered.length === 0) {
    return { status: "skipped", renderedBody: null, missing: [], errorMessage: NO_DATA_MESSAGE, warnings };
  }
  return {
    status: "generated",
    renderedBody: rendered.map((r) => r.text).join("\n\n"),
    missing: unionMissing(rendered),
    errorMessage: warnings.length > 0 ? redactSecrets(warnings.join(" | ")) : null,
    warnings,
  };
}

export async function runGeneration(store: GenerationStore, options: { now: Date }): Promise<GenerationResult> {
  const insert = await store.insertRun();
  if (!insert.inserted) return { skipped: true };

  let outcome: RunPatch & { warnings: string[] };
  try {
    const report = await store.loadReport();
    outcome = report
      ? await renderReport(report, store, options.now)
      : { status: "failed", renderedBody: null, missing: [], errorMessage: "Relatório não encontrado.", warnings: [] };
  } catch (err) {
    outcome = { status: "failed", renderedBody: null, missing: [], errorMessage: errorMessage(err), warnings: [] };
  }

  const { warnings, ...patch } = outcome;
  await store.finishRun(insert.runId, patch);
  return { skipped: false, runId: insert.runId, status: patch.status, renderedBody: patch.renderedBody, missing: patch.missing, warnings };
}
