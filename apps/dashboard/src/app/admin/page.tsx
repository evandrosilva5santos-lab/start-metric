import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAdminOrgContext } from "@/lib/admin/context";
import AdminPanelClient from "./AdminPanelClient";

export const metadata: Metadata = {
  title: "Admin | Start Metric",
  description:
    "Painel administrativo para gerenciar usuários, planos, logs técnicos e problemas com diagnóstico detalhado.",
};

export default async function AdminPage() {
  const auth = await requireAdminOrgContext();
  if (!auth.ok) {
    if (auth.error.status === 401) {
      redirect("/admin/auth?next=/admin");
    }
    redirect("/performance");
  }

  return <AdminPanelClient />;
}
