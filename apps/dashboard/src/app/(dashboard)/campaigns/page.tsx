import type { Metadata } from "next";
import { CampanhasClient } from "@/components/meta/CampanhasClient";

export const metadata: Metadata = {
  title: "Campanhas | Start Metric",
  description: "Acompanhe, pause e ajuste o orçamento das campanhas da Meta.",
};

export default function CampaignsPage() {
  return <CampanhasClient />;
}
