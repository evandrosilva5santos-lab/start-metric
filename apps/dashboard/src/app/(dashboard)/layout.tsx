import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { getSessionIdentity } from "@/lib/auth/session";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Não espera: a promessa segue para o navegador junto com o HTML e o
  // conteúdo da página aparece sem aguardar o nome do usuário.
  const identity = getSessionIdentity();

  return (
    <div className="flex min-h-screen overflow-hidden bg-background text-foreground selection:bg-primary/25">
      {/* Acessibilidade: Link de salto para o conteúdo principal (WCAG 2.1 AA) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:font-bold focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Pular para o conteúdo principal
      </a>

      <Sidebar identity={identity} />

      <div className="flex-1 flex flex-col min-w-0 lg:ml-[240px]">
        <Header identity={identity} />

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-8 custom-scrollbar focus:outline-none"
        >
          <div className="max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
