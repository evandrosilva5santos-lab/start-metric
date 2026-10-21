import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDashboardSession, type DashboardSession } from "@/lib/auth/session";
import { MAX_CARDS } from "@/lib/dashboard/cards/catalog";
import { validateCardSlugs } from "@/lib/dashboard/cards/layout";
import {
  LayoutStoreError,
  deleteClientLayout,
  findActiveClient,
  readClientLayout,
  saveClientLayout,
  type LayoutDb,
} from "@/lib/dashboard/cards/store";

type Params = Promise<{ id: string }>;
type AuthorizedSession = Extract<DashboardSession, { isAuthorized: true }>;
type Scope = { session: AuthorizedSession; db: LayoutDb; clientId: string };

const clientIdSchema = z.string().uuid();
const layoutSchema = z.object({
  cards: z.array(z.string().min(1).max(120)).min(1).max(MAX_CARDS * 2),
});

function fail(status: number, error: string): NextResponse {
  return NextResponse.json({ error }, { status });
}

async function resolveScope(params: Params): Promise<Scope | NextResponse> {
  const { id } = await params;
  const parsedId = clientIdSchema.safeParse(id);
  if (!parsedId.success) return fail(400, "Cliente inválido.");
  const session = await getDashboardSession();
  if (!session.isAuthorized) return fail(401, "Não autorizado");
  const db = session.supabase as unknown as LayoutDb;
  const client = await findActiveClient(db, session.orgId, parsedId.data);
  if (!client) return fail(404, "Cliente não encontrado");
  return { session, db, clientId: client.id };
}

function storeFailure(error: unknown, action: string): NextResponse {
  if (error instanceof LayoutStoreError && error.missingTable) {
    return fail(503, "A tabela de layouts ainda não foi criada no banco. Aplique a migração e tente de novo.");
  }
  console.error(`[dashboard-layout] Falha ao ${action}:`, error instanceof Error ? error.message : error);
  return fail(500, `Não foi possível ${action} a personalização.`);
}

export async function GET(_request: NextRequest, { params }: { params: Params }) {
  try {
    const scope = await resolveScope(params);
    if (scope instanceof NextResponse) return scope;
    const layout = await readClientLayout(scope.db, scope.session.orgId, scope.clientId);
    return NextResponse.json({ data: layout });
  } catch (error) {
    return storeFailure(error, "carregar");
  }
}

export async function PUT(request: NextRequest, { params }: { params: Params }) {
  try {
    const scope = await resolveScope(params);
    if (scope instanceof NextResponse) return scope;
    const body = layoutSchema.safeParse(await request.json().catch(() => null));
    if (!body.success) return fail(400, `Envie de 1 a ${MAX_CARDS} métricas.`);
    const validation = validateCardSlugs(body.data.cards);
    if (!validation.ok) return fail(400, validation.error);
    const userId = scope.session.isPainel ? null : scope.session.user.id;
    const layout = await saveClientLayout(scope.db, scope.session.orgId, scope.clientId, validation.cards, userId);
    return NextResponse.json({ data: layout });
  } catch (error) {
    return storeFailure(error, "salvar");
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Params }) {
  try {
    const scope = await resolveScope(params);
    if (scope instanceof NextResponse) return scope;
    await deleteClientLayout(scope.db, scope.session.orgId, scope.clientId);
    return NextResponse.json({ data: { cards: null, updatedAt: null, available: true } });
  } catch (error) {
    return storeFailure(error, "restaurar");
  }
}
