import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getDashboardData } from "@/lib/dashboard/queries";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const metadata: Metadata = {
  title: "Dashboard | Start Metric",
  description: "Painel principal com ROAS, CPA e lucro real por campanha.",
};

export default async function DashboardPage() {
  let data: Awaited<ReturnType<typeof getDashboardData>>;
  try {
    data = await getDashboardData({});
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    if (message === "UNAUTHORIZED") redirect("/auth");
    throw error;
  }

  return (
    <>
      <DashboardClient initialData={data} />
    </>
  );
}
