import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { TrackingBootstrap } from "@/components/tracking/TrackingBootstrap";
import { GlobalStatusOverlay } from "@/components/layout/GlobalStatusOverlay";

export const metadata: Metadata = {
  title: "Start Metric — Inteligência de ROI para Tráfego Pago",
  description:
    "Plataforma de análise de performance para gestores de tráfego. Monitore ROAS, criativos e ROI em tempo real.",
  keywords: ["tráfego pago", "meta ads", "ROAS", "gestão de campanhas", "ROI"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="font-sans antialiased bg-grid">
        <QueryProvider>
          <GlobalStatusOverlay />
          <Suspense fallback={null}>
            <TrackingBootstrap />
          </Suspense>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
