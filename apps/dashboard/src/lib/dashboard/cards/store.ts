import "server-only";

import type { getServerSupabase } from "@/lib/auth/session";
import { sanitizeStoredCards } from "./layout";

export type LayoutDb = Awaited<ReturnType<typeof getServerSupabase>>;

export type StoredLayout = { cards: string[] | null; updatedAt: string | null; available: boolean };

const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class LayoutStoreError extends Error {
  constructor(
    message: string,
    readonly missingTable: boolean,
  ) {
    super(message);
  }
}

function storeError(error: { message: string; code?: string }): LayoutStoreError {
  return new LayoutStoreError(error.message, MISSING_TABLE_CODES.has(error.code ?? ""));
}

export async function findActiveClient(
  db: LayoutDb,
  orgId: string,
  clientId: string,
): Promise<{ id: string; name: string } | null> {
  const { data, error } = await db
    .from("clients")
    .select("id, name")
    .eq("id", clientId)
    .eq("org_id", orgId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw storeError(error);
  return data ? { id: data.id, name: data.name } : null;
}

export async function readClientLayout(db: LayoutDb, orgId: string, clientId: string): Promise<StoredLayout> {
  const { data, error } = await db
    .from("client_dashboard_layouts")
    .select("cards, updated_at")
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) {
    const failure = storeError(error);
    if (failure.missingTable) return { cards: null, updatedAt: null, available: false };
    throw failure;
  }
  return { cards: sanitizeStoredCards(data?.cards ?? null), updatedAt: data?.updated_at ?? null, available: true };
}

export async function saveClientLayout(
  db: LayoutDb,
  orgId: string,
  clientId: string,
  cards: readonly string[],
  userId: string | null,
): Promise<StoredLayout> {
  const { data, error } = await db
    .from("client_dashboard_layouts")
    .upsert(
      { org_id: orgId, client_id: clientId, cards: [...cards], updated_by: userId && UUID.test(userId) ? userId : null },
      { onConflict: "client_id" },
    )
    .select("cards, updated_at")
    .single();
  if (error) throw storeError(error);
  return { cards: sanitizeStoredCards(data.cards), updatedAt: data.updated_at, available: true };
}

export async function deleteClientLayout(db: LayoutDb, orgId: string, clientId: string): Promise<void> {
  const { error } = await db
    .from("client_dashboard_layouts")
    .delete()
    .eq("org_id", orgId)
    .eq("client_id", clientId);
  if (error) throw storeError(error);
}
