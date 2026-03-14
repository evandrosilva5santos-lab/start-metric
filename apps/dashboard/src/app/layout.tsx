import type { Metadata } from "next";
import { Suspense } from "react";
import { Space_Grotesk, Sora } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { TrackingBootstrap } from "@/components/tracking/TrackingBootstrap";
import { GlobalStatusOverlay } from "@/components/layout/GlobalStatusOverlay";

const fontBody = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const fontDisplay = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "600", "700", "800"],
  display: "swap",
});

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
    <html lang="pt-BR" className={`dark ${fontBody.variable} ${fontDisplay.variable}`}>
      <body className="font-sans antialiased bg-grid selection:bg-cyan-400/25 selection:text-white">
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
