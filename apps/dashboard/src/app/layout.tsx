import { Suspense } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { TrackingBootstrap } from "@/components/tracking/TrackingBootstrap";
import { GlobalStatusOverlay } from "@/components/layout/GlobalStatusOverlay";
import { ThemeProvider } from "@/components/providers/ThemeProvider";

const fontSans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#171717" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "Start Metric — Inteligência de ROI para Tráfego Pago",
  description:
    "Plataforma de análise de performance para gestores de tráfego. Monitore ROAS, lucro e ROI em tempo real.",
  keywords: ["tráfego pago", "meta ads", "ROAS", "gestão de campanhas", "ROI"],
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Start Metric",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning className={`${fontSans.variable} ${fontMono.variable}`}>
      <body className="bg-background font-body text-foreground antialiased">
        <ThemeProvider>
          <QueryProvider>
            <GlobalStatusOverlay />
            <Suspense fallback={null}>
              <TrackingBootstrap />
            </Suspense>
            {children}
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
