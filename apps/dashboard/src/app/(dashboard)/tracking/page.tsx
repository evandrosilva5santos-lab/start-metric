import type { Metadata } from "next";
import { TrackingClient } from "@/components/meta/TrackingClient";

export const metadata: Metadata = {
  title: "Rastreamento & Retargeting | Start Metric",
  description: "Auditoria de parâmetros de URL dos anúncios, gerador de checkout e inteligência de remarketing.",
};

export default function TrackingPage() {
  return <TrackingClient />;
}
