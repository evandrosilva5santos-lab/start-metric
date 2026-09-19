import type { Metadata } from "next";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard | Start Metric",
  description: "Painel principal com ROAS, CPA e lucro real por campanha.",
};

export default function DashboardPage() {
  return <DashboardClient />;
}
