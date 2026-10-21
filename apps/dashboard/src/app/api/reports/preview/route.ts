import { NextResponse, type NextRequest } from "next/server";
import { renderTemplate } from "@/lib/reports/engine/render";
import { createPartDataSource, loadAccounts, type ReportsDb } from "@/lib/reports/data";
import { renderLivePart, selectPartAccounts, type AccountInfo } from "@/lib/reports/generate-core";
import { jsonError, readJson, requireReportsSession, serverError } from "@/lib/reports/http";
import { resolvePeriod } from "@/lib/reports/period";
import { previewSchema, type PreviewInput } from "@/lib/reports/schema";
import { rateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

async function clientNameFor(db: ReportsDb, orgId: string, clientId: string | null): Promise<string | null | undefined> {
  if (!clientId) return null;
  const { data, error } = await db.from("clients").select("name").eq("id", clientId).eq("org_id", orgId).maybeSingle();
  if (error) throw new Error(`Falha ao ler cliente: ${error.message}`);
  return data ? data.name : undefined;
}

interface Target {
  clientId: string | null;
  accounts: AccountInfo[];
}

async function resolveTarget(db: ReportsDb, orgId: string, input: PreviewInput): Promise<Target | null> {
  const accounts = await loadAccounts(db, orgId, input.clientId ?? null, input.adAccountId ? [input.adAccountId] : []);
  if (!input.adAccountId) return { clientId: input.clientId ?? null, accounts: accounts.filter((a) => a.clientId === input.clientId) };

  const account = accounts.find((a) => a.id === input.adAccountId);
  if (!account) return null;
  const clientId = input.clientId ?? account.clientId;
  if (!clientId) return { clientId: null, accounts: [account] };
  const selected = selectPartAccounts(account.id, clientId, accounts);
  return selected.length > 0 ? { clientId, accounts: selected } : null;
}

export async function POST(request: NextRequest) {
  const auth = await requireReportsSession();
  if (!auth.ok) return auth.response;
  const { db, orgId } = auth.value;
  const body = await readJson(request, previewSchema);
  if (!body.ok) return body.response;
  if (body.value.mode === "live") {
    const rl = rateLimit(`reports-live-preview:${orgId}`, { limit: 20, windowMs: 60_000 });
    if (!rl.allowed) return jsonError(429, `Muitas pré-visualizações com dados reais. Tente de novo em ${rl.retryAfterSeconds}s.`);
  }
  const input = body.value;
  const now = new Date();
  const periodInput = { period: input.period, customStart: input.customStart, customEnd: input.customEnd };

  try {
    if (input.mode === "preview") {
      const clientName = await clientNameFor(db, orgId, input.clientId ?? null);
      if (clientName === undefined) return jsonError(404, "Cliente não encontrado");
      const period = resolvePeriod(periodInput, now, input.timezone);
      const { text, missing } = renderTemplate(
        input.body,
        { clientName: clientName ?? undefined, startDate: period.startDate, endDate: period.endDate, timezone: input.timezone, now },
        "preview",
      );
      return NextResponse.json({ data: { text, missing, warnings: [] } });
    }

    const target = await resolveTarget(db, orgId, input);
    if (!target) return jsonError(404, "Conta de anúncio não encontrada para este cliente");
    const clientName = await clientNameFor(db, orgId, target.clientId);
    if (clientName === undefined) return jsonError(404, "Cliente não encontrado");

    const result = await renderLivePart(
      {
        body: input.body,
        period: periodInput,
        accounts: target.accounts,
        clientName,
        timezone: input.timezone,
        now,
        sendWithoutData: true,
      },
      createPartDataSource(db, orgId),
    );
    return NextResponse.json({ data: { text: result.text, missing: result.missing, warnings: result.warnings } });
  } catch (err) {
    return serverError("pré-visualizar relatório", err);
  }
}
