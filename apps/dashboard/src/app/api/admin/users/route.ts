import { NextResponse } from "next/server";
import { requireAdminOrgContext } from "@/lib/admin/context";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTrimmedString, optionalTrimmedString, readBodyObject } from "@/lib/admin/validation";
import type { AdminUser, AdminUserRole } from "@/lib/admin/types";

type ProfileRow = {
  id: string;
  name: string | null;
  phone: string | null;
  role: string;
  created_at: string | null;
};

type SubscriptionRow = {
  user_id: string;
  status: "trial" | "active" | "paused" | "cancelled";
  started_at: string;
  ends_at: string | null;
  plan_id: string;
  admin_plans: {
    code: string;
    name: string;
  } | null;
};

function randomPassword(length = 18): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%^&*";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)] ?? "A";
  }
  return result;
}

function isAllowedRole(role: string): role is AdminUserRole {
  return role === "owner" || role === "manager" || role === "analyst" || role === "viewer";
}

export async function GET(): Promise<NextResponse> {
  const auth = await requireAdminOrgContext();
  if (!auth.ok) {
    return auth.error;
  }

  const adminClient = createAdminClient();

  const [profilesResult, subscriptionsResult, usersResult] = await Promise.all([
    adminClient
      .from("profiles")
      .select("id, name, phone, role, created_at")
      .eq("org_id", auth.context.orgId)
      .order("created_at", { ascending: false }),
    adminClient
      .from("admin_user_subscriptions")
      .select("user_id, status, started_at, ends_at, plan_id, admin_plans(name, code)")
      .eq("org_id", auth.context.orgId),
    adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  if (profilesResult.error) {
    return NextResponse.json({ error: profilesResult.error.message }, { status: 500 });
  }

  if (subscriptionsResult.error) {
    return NextResponse.json({ error: subscriptionsResult.error.message }, { status: 500 });
  }

  if (usersResult.error) {
    return NextResponse.json({ error: usersResult.error.message }, { status: 500 });
  }

  const emailById = new Map<string, string | null>();
  for (const user of usersResult.data.users ?? []) {
    emailById.set(user.id, user.email ?? null);
  }

  const subscriptionByUserId = new Map<string, SubscriptionRow>();
  for (const subscription of (subscriptionsResult.data ?? []) as unknown as SubscriptionRow[]) {
    subscriptionByUserId.set(subscription.user_id, subscription);
  }

  const users: AdminUser[] = ((profilesResult.data ?? []) as ProfileRow[]).map((profile) => {
    const subscription = subscriptionByUserId.get(profile.id);

    return {
      id: profile.id,
      email: emailById.get(profile.id) ?? null,
      name: profile.name,
      phone: profile.phone,
      role: profile.role,
      created_at: profile.created_at,
      subscription: subscription
        ? {
            plan_id: subscription.plan_id,
            plan_name: subscription.admin_plans?.name ?? "Plano sem nome",
            plan_code: subscription.admin_plans?.code ?? "sem-codigo",
            status: subscription.status,
            started_at: subscription.started_at,
            ends_at: subscription.ends_at,
          }
        : null,
    };
  });

  return NextResponse.json({ users });
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

  const email = getTrimmedString(body.email).toLowerCase();
  const name = optionalTrimmedString(body.name) ?? null;
  const phone = optionalTrimmedString(body.phone);
  const roleRaw = getTrimmedString(body.role) || "viewer";
  const planId = optionalTrimmedString(body.planId);
  const password = optionalTrimmedString(body.password) ?? randomPassword();

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "E-mail inválido" }, { status: 422 });
  }

  if (!isAllowedRole(roleRaw)) {
    return NextResponse.json({ error: "Role inválida" }, { status: 422 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Senha deve ter pelo menos 8 caracteres" }, { status: 422 });
  }

  const adminClient = createAdminClient();

  if (planId) {
    const { data: plan, error: planError } = await adminClient
      .from("admin_plans")
      .select("id")
      .eq("id", planId)
      .eq("org_id", auth.context.orgId)
      .single();

    if (planError || !plan?.id) {
      return NextResponse.json({ error: "Plano não encontrado para esta organização" }, { status: 404 });
    }
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name,
      full_name: name,
      phone,
    },
  });

  if (createError || !created?.user) {
    return NextResponse.json({ error: createError?.message ?? "Não foi possível criar usuário" }, { status: 400 });
  }

  const newUserId = created.user.id;

  const { error: profileError } = await adminClient.from("profiles").upsert(
    {
      id: newUserId,
      name,
      phone,
      org_id: auth.context.orgId,
      role: roleRaw,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    return NextResponse.json({ error: `Usuário criado, mas perfil falhou: ${profileError.message}` }, { status: 500 });
  }

  if (planId) {
    const { error: subscriptionError } = await adminClient
      .from("admin_user_subscriptions")
      .upsert(
        {
          org_id: auth.context.orgId,
          user_id: newUserId,
          plan_id: planId,
          status: "active",
          is_mock: true,
          created_by: auth.context.userId,
        },
        { onConflict: "org_id,user_id" },
      );

    if (subscriptionError) {
      return NextResponse.json(
        {
          error: `Usuário criado, mas associação de plano falhou: ${subscriptionError.message}`,
        },
        { status: 500 },
      );
    }
  }

  const { error: logError } = await adminClient.from("admin_user_logs").insert({
    org_id: auth.context.orgId,
    user_id: newUserId,
    actor_user_id: auth.context.userId,
    level: "info",
    event: "admin_user_created",
    root_cause: "Provisionamento manual via painel admin.",
    detailed_analysis: "Usuário criado via endpoint /api/admin/users e vinculado à organização atual.",
    source: "admin_panel",
    context_json: {
      role: roleRaw,
      hasPlan: Boolean(planId),
    },
  });

  if (logError) {
    // não bloqueia resposta de criação de usuário
    console.error("[admin/users] failed to write creation log", logError.message);
  }

  return NextResponse.json(
    {
      user: {
        id: newUserId,
        email: created.user.email,
        role: roleRaw,
        name,
        phone,
      },
    },
    { status: 201 },
  );
}
