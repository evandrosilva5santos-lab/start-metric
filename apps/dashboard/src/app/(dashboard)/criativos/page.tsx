import type { Metadata } from "next";
import { Suspense } from "react";
import { CriativosClient } from "@/components/meta/CriativosClient";
import { SkeletonCreativeGrid } from "@/components/ui/Skeleton";

export const metadata: Metadata = {
  title: "Criativos | Start Metric",
  description: "Gancho, retenção e sinais de cansaço de cada anúncio.",
};

export default function CriativosPage() {
  return (
    <Suspense fallback={<SkeletonCreativeGrid />}>
      <CriativosClient />
    </Suspense>
  );
}
