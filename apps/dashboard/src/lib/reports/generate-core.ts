import { ACTION_TYPE_TRANSLATIONS } from "./engine/catalog";
import { DEFAULT_RESULT_ACTION_TYPES } from "./engine/insights-map";
import {
  aggregateDailyMetrics,
  aggregateGoogleRows,
  mergeMetrics,
  primaryResult,
  totalMetrics,
  type DailyMetricRow,
  type GoogleDailyRow,
  type MetricValues,
} from "./engine/metrics";
import { renderTemplate, type CreativeRow, type KeywordRow } from "./engine/render";
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
  name?: string | null;
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
  loadGoogleRows(accountIds: readonly string[], range: DateRange): Promise<GoogleDailyRow[]>;
  loadInsightMetrics(account: AccountInfo, range: DateRange): Promise<MetricValues>;
  loadTopCreatives(account: AccountInfo, range: DateRange): Promise<CreativeRow[]>;
  loadGoogleKeywords(account: AccountInfo, range: DateRange): Promise<GoogleKeywordSummary>;
}

export interface GoogleKeywordSummary {
  ranking: KeywordRow[];
  qualityScore: number | null;
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
const ACCOUNT_INSIGHT_SLUG = /^(meta_(reach|frequency|video_)|reach$)/;
const CREATIVE_RANKING_SLUG = /^meta_((top_\d+|all)_creatives_ranking|all_creatives_simple)$/;
const KEYWORD_SLUG = /^google_((top_\d+|all)_keywords_ranking|all_keywords_simple|quality_score)$/;
const MAX_ERROR_LENGTH = 1000;
const NO_DATA_MESSAGE = "Sem dados no período para nenhuma parte.";

export function templateNeeds(body: string): { accountInsights: boolean; creatives: boolean; keywords: boolean } {
  const slugs = [...body.matchAll(PLACEHOLDER)].map((m) => m[1]);
  return {
    accountInsights: slugs.some((s) => ACCOUNT_INSIGHT_SLUG.test(s)),
    creatives: slugs.some((s) => CREATIVE_RANKING_SLUG.test(s)),
    keywords: slugs.some((s) => KEYWORD_SLUG.test(s)),
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
  keywords: KeywordRow[];
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

async function loadMetaLive(
  needs: ReturnType<typeof templateNeeds>,
  accounts: readonly AccountInfo[],
  range: DateRange,
  source: PartDataSource,
  warnings: string[],
): Promise<{ metrics: MetricValues; creatives: CreativeRow[] }> {
  if (!needs.accountInsights && !needs.creatives) return { metrics: {}, creatives: [] };
  const metaAccounts = accounts.filter((a) => a.platform === "meta");
  if (metaAccounts.length !== 1) {
    warnings.push(
      `Alcance, frequência, vídeo e ranking de criativos exigem uma única conta Meta; a parte usa ${metaAccounts.length} contas.`,
    );
    return { metrics: {}, creatives: [] };
  }
  const [account] = metaAccounts;
  const [metrics, creatives] = await Promise.all([
    needs.accountInsights ? attempt("Insights da Meta indisponível", () => source.loadInsightMetrics(account, range), warnings) : null,
    needs.creatives ? attempt("Ranking de criativos indisponível", () => source.loadTopCreatives(account, range), warnings) : null,
  ]);
  return { metrics: metrics ?? {}, creatives: creatives ?? [] };
}

async function loadGoogleLive(
  needs: ReturnType<typeof templateNeeds>,
  accounts: readonly AccountInfo[],
  range: DateRange,
  source: PartDataSource,
  warnings: string[],
): Promise<{ metrics: MetricValues; keywords: KeywordRow[] }> {
  if (!needs.keywords) return { metrics: {}, keywords: [] };
  const googleAccounts = accounts.filter((a) => a.platform === "google");
  if (googleAccounts.length !== 1) {
    warnings.push(`Palavras-chave e índice de qualidade exigem uma única conta Google; a parte usa ${googleAccounts.length} contas.`);
    return { metrics: {}, keywords: [] };
  }
  const summary = await attempt("Palavras-chave do Google indisponíveis", () => source.loadGoogleKeywords(googleAccounts[0], range), warnings);
  if (!summary) return { metrics: {}, keywords: [] };
  return {
    metrics: summary.qualityScore === null ? {} : { google_quality_score: summary.qualityScore },
    keywords: summary.ranking,
  };
}

async function loadLiveData(
  body: string,
  accounts: readonly AccountInfo[],
  range: DateRange,
  source: PartDataSource,
): Promise<LiveData> {
  const needs = templateNeeds(body);
  const warnings: string[] = [];
  const [meta, google] = await Promise.all([
    loadMetaLive(needs, accounts, range, source, warnings),
    loadGoogleLive(needs, accounts, range, source, warnings),
  ]);
  return { metrics: mergeMetrics(meta.metrics, google.metrics), creatives: meta.creatives, keywords: google.keywords, warnings };
}

function joinUnique(values: ReadonlyArray<string | null | undefined>): string | undefined {
  const unique = [...new Set(values.filter((v): v is string => Boolean(v)))];
  return unique.length > 0 ? unique.join(", ") : undefined;
}

/** Nomes e moedas das contas da parte, por canal e "(total)". */
function accountTexts(accounts: readonly AccountInfo[]): Record<string, string> {
  const of = (platform?: string) => accounts.filter((a) => !platform || a.platform === platform);
  const entries: Array<[string, string | undefined]> = [
    ["account_name", joinUnique(of().map((a) => a.name))],
    ["meta_account_name", joinUnique(of("meta").map((a) => a.name))],
    ["google_account_name", joinUnique(of("google").map((a) => a.name))],
    ["currency", joinUnique(of().map((a) => a.currency))],
    ["meta_currency", joinUnique(of("meta").map((a) => a.currency))],
    ["google_currency", joinUnique(of("google").map((a) => a.currency))],
  ];
  return Object.fromEntries(entries.filter((e): e is [string, string] => e[1] !== undefined));
}

function resultTexts(metrics: MetricValues): { texts: Record<string, string>; metrics: Record<string, number> } {
  const result = primaryResult(metrics, DEFAULT_RESULT_ACTION_TYPES);
  if (!result) return { texts: {}, metrics: {} };
  return {
    texts: { meta_result_type: ACTION_TYPE_TRANSLATIONS[result.type] ?? result.type },
    metrics: { meta_result_value: result.value },
  };
}

export async function renderLivePart(input: RenderPartInput, source: PartDataSource): Promise<RenderPartResult> {
  const period = resolvePeriod(input.period, input.now, input.timezone);
  const range = { since: period.since, until: period.until };
  const metaIds = input.accounts.filter((a) => a.platform !== "google").map((a) => a.id);
  const googleIds = input.accounts.filter((a) => a.platform === "google").map((a) => a.id);
  const [rows, googleRows] = await Promise.all([
    metaIds.length > 0 ? source.loadDailyRows(metaIds, range) : [],
    googleIds.length > 0 ? source.loadGoogleRows(googleIds, range) : [],
  ]);

  if (rows.length === 0 && googleRows.length === 0 && !input.sendWithoutData) {
    return { text: "", missing: [], skipped: true, warnings: [] };
  }

  const live = await loadLiveData(input.body, input.accounts, range, source);
  const channels = mergeMetrics(aggregateDailyMetrics(rows), aggregateGoogleRows(googleRows), live.metrics);
  const result = resultTexts(channels);
  const { text, missing, errors } = renderTemplate(
    input.body,
    {
      clientName: input.clientName ?? undefined,
      startDate: period.startDate,
      endDate: period.endDate,
      metrics: mergeMetrics(channels, totalMetrics(channels), result.metrics),
      texts: { ...accountTexts(input.accounts), ...result.texts },
      creatives: live.creatives,
      keywords: live.keywords,
      currency: input.accounts[0]?.currency ?? undefined,
      timezone: input.timezone,
      now: input.now,
    },
    "live",
  );
  return { text, missing, skipped: false, warnings: [...live.warnings, ...(errors ?? [])] };
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
