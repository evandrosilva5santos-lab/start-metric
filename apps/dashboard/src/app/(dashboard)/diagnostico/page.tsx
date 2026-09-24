import type { Metadata } from "next";
import { DiagnosticoClient } from "@/components/meta/DiagnosticoClient";

export const metadata: Metadata = {
  title: "Diagnóstico | Start Metric",
  description: "Avisos da conta em português, com o que fazer em cada caso.",
};

export default function DiagnosticoPage() {
  return <DiagnosticoClient />;
}
