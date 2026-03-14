// app/api/meta/connect/route.ts — legado
// Mantido apenas por compatibilidade: o fluxo oficial é OAuth em /api/meta/oauth.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface ErrorResponse {
  error: string;
}

export async function POST(): Promise<NextResponse<ErrorResponse>> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json(
      { error: "Não autenticado. Faça login antes de conectar o Meta Ads." },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      error:
        "Endpoint legado. Use o fluxo OAuth via GET /api/meta/oauth para conectar contas Meta.",
    },
    { status: 410 },
  );
}
