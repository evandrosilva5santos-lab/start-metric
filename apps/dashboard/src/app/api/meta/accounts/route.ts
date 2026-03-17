import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type AccountRow = {
  id: string;
  name: string;
  currency: string | null;
  is_active: boolean;
  account_status: number;
};

function statusToCode(status: string): number {
  if (status === "active") return 1;
  if (status === "expired") return 3;
  if (status === "disconnected") return 101;
  return 0;
}

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Não autenticado" },
      { status: 401 },
    );
  }

  const { data, error } = await supabase
    .from("ad_accounts")
    .select("id, name, currency, status")
    .eq("platform", "meta")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "Erro ao buscar contas Meta", detail: error.message },
      { status: 500 },
    );
  }

  const accounts: AccountRow[] = (data ?? []).map((row) => {
    const code = statusToCode(row.status);
    return {
      id: row.id,
      name: row.name,
      currency: row.currency,
      is_active: code === 1,
      account_status: code,
    };
  });

  return NextResponse.json({ data: accounts });
}
