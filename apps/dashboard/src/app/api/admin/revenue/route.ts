import { NextResponse } from "next/server";
import { requireAdminOrgContext } from "@/lib/admin/context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getTrimmedString,
  integerOrNull,
  numberOrNull,
  optionalTrimmedString,
  readBodyObject,
} from "@/lib/admin/validation";
import type { AdminRevenueSnapshot } from "@/lib/admin/types";

function buildGeneratedSnapshots(): AdminRevenueSnapshot[] {
  const today = new Date();
  const snapshots: AdminRevenueSnapshot[] = [];

  let baseMrr = 9500;
  for (let i = 5; i >= 0; i -= 1) {
    const referenceDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const growth = 1 + (i % 2 === 0 ? 0.08 : 0.05);
    baseMrr = Math.round(baseMrr * growth);

    const churn = Number((2.1 + i * 0.18).toFixed(2));
    const newCustomers = Math.max(3, 14 - i);

    snapshots.push({
      id: `generated-${referenceDate.toISOString().slice(0, 10)}`,
      snapshot_date: referenceDate.toISOString().slice(0, 10),
      mrr: baseMrr,
      arr: baseMrr * 12,
      churn_rate: churn,
      new_customers: newCustomers,
      notes: "Snapshot fictício automático para visualização inicial.",
      is_mock: true,
      created_at: new Date().toISOString(),
    });
  }

  return snapshots;
}

export async function GET(): Promise<NextResponse> {
  const auth = await requireAdminOrgContext();
  if (!auth.ok) {
    return auth.error;
  }

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("admin_revenue_snapshots_mock")
    .select("id, snapshot_date, mrr, arr, churn_rate, new_customers, notes, is_mock, created_at")
    .eq("org_id", auth.context.orgId)
    .order("snapshot_date", { ascending: true })
    .limit(180);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const snapshots = (data ?? []) as unknown as AdminRevenueSnapshot[];

  if (snapshots.length === 0) {
    return NextResponse.json({ snapshots: buildGeneratedSnapshots(), generated: true });
  }

  return NextResponse.json({ snapshots, generated: false });
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireAdminOrgContext();
  if (!auth.ok) {
    return auth.error;
  }

  let bodyRaw: unknown;
  try {
    bodyRaw = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const body = readBodyObject(bodyRaw);
  if (!body) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const snapshotDate = getTrimmedString(body.snapshotDate);
  const mrr = numberOrNull(body.mrr);
  const arrInput = numberOrNull(body.arr);
  const churnRate = numberOrNull(body.churnRate) ?? 0;
  const newCustomers = integerOrNull(body.newCustomers) ?? 0;
  const notes = optionalTrimmedString(body.notes);

  if (!snapshotDate) {
    return NextResponse.json({ error: "snapshotDate é obrigatório" }, { status: 422 });
  }

  const date = new Date(snapshotDate);
  if (Number.isNaN(date.getTime())) {
    return NextResponse.json({ error: "snapshotDate inválido" }, { status: 422 });
  }

  if (mrr === null || mrr < 0) {
    return NextResponse.json({ error: "mrr inválido" }, { status: 422 });
  }

  const arr = arrInput !== null && arrInput >= 0 ? arrInput : mrr * 12;

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("admin_revenue_snapshots_mock")
    .upsert(
      {
        org_id: auth.context.orgId,
        snapshot_date: date.toISOString().slice(0, 10),
        mrr,
        arr,
        churn_rate: Math.max(0, churnRate),
        new_customers: Math.max(0, newCustomers),
        notes,
        is_mock: true,
        created_by: auth.context.userId,
      },
      { onConflict: "org_id,snapshot_date" },
    )
    .select("id, snapshot_date, mrr, arr, churn_rate, new_customers, notes, is_mock, created_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ snapshot: data }, { status: 201 });
}
