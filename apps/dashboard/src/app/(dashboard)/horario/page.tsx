import type { Metadata } from "next";
import { HorarioClient } from "@/components/meta/HorarioClient";

export const metadata: Metadata = {
  title: "Horário | Start Metric",
  description: "Mapa de calor dos melhores dias e horários da conta.",
};

export default function HorarioPage() {
  return <HorarioClient />;
}
