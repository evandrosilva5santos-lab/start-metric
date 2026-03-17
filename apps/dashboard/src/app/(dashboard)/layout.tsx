"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen text-slate-200 bg-[#020617] selection:bg-cyan-500/30 overflow-hidden">
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-w-0 lg:ml-[280px] transition-all duration-500 ease-in-out">
        <Header />
        
        <main className="flex-1 overflow-y-auto px-4 md:px-8 py-8 custom-scrollbar">
          <div className="max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
