import type { Metadata } from "next";
import { Suspense } from "react";
import { HorarioClient } from "@/components/meta/HorarioClient";
import { SkeletonHeatmap } from "@/components/ui/Skeleton";

export const metadata: Metadata = {
  title: "Horário | Start Metric",
  description: "Mapa de calor dos melhores dias e horários da conta.",
};

export default function HorarioPage() {
  return (
    <Suspense fallback={<SkeletonHeatmap />}>
      <HorarioClient />
    </Suspense>
  );
}
