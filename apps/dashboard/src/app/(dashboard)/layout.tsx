import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen text-slate-200 bg-[#020617] selection:bg-cyan-500/30 overflow-hidden">
      {/* Acessibilidade: Link de salto para o conteúdo principal (WCAG 2.1 AA) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-cyan-400 focus:text-slate-950 focus:font-bold focus:rounded-xl focus:shadow-xl focus:outline-none focus:ring-2 focus:ring-cyan-300"
      >
        Pular para o conteúdo principal
      </a>

      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 lg:ml-[280px] transition-all duration-500 ease-in-out">
        <Header />

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto px-4 md:px-8 py-8 custom-scrollbar focus:outline-none"
        >
          <div className="max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
