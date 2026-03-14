"use client";

import { Header } from "@/components/layout/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen text-slate-200 bg-[#020617] selection:bg-cyan-500/30">
      <Header />
      
      <div className="flex-1 w-full flex flex-col min-w-0">
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
