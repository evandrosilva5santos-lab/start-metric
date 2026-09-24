import type { Metadata } from "next";
import { CriativosClient } from "@/components/meta/CriativosClient";

export const metadata: Metadata = {
  title: "Criativos | Start Metric",
  description: "Gancho, retenção e sinais de cansaço de cada anúncio.",
};

export default function CriativosPage() {
  return <CriativosClient />;
}
