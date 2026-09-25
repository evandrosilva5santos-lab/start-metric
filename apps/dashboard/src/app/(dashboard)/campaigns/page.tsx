import type { Metadata } from "next";
import { Suspense } from "react";
import { CampanhasClient } from "@/components/meta/CampanhasClient";
import { SkeletonTable } from "@/components/ui/Skeleton";

export const metadata: Metadata = {
  title: "Campanhas | Start Metric",
  description: "Acompanhe, pause e ajuste o orçamento das campanhas da Meta.",
};

export default function CampaignsPage() {
  return (
    <Suspense fallback={<SkeletonTable />}>
      <CampanhasClient />
    </Suspense>
  );
}
