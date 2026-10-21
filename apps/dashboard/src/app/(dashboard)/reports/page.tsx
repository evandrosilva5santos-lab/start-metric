import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Skeleton } from "@/components/ui/Skeleton";
import { isPainelAuthorized, PAINEL_COOKIE_NAME } from "@/lib/auth/painel";
import { createClient } from "@/lib/supabase/server";
import { ReportsClient } from "./ReportsClient";

export const metadata: Metadata = {
  title: "Relatórios | Start Metric",
  description: "Relatórios devidos e atrasados: gerar, enviar, receber e aprovar, com comprovante.",
};

async function hasUser(): Promise<boolean> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    return Boolean(data.user);
  } catch {
    return false;
  }
}

function ReportsFallback() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando relatórios">
      <Skeleton className="h-12 w-72 rounded-panel" />
      <Skeleton className="h-24 rounded-panel" />
      <Skeleton className="h-64 rounded-panel" />
    </div>
  );
}

export default async function ReportsPage() {
  const cookieStore = await cookies();
  const isPainel = await isPainelAuthorized(cookieStore.get(PAINEL_COOKIE_NAME)?.value);
  if (!isPainel && !(await hasUser())) redirect("/auth");

  return (
    <Suspense fallback={<ReportsFallback />}>
      <ReportsClient />
    </Suspense>
  );
}
