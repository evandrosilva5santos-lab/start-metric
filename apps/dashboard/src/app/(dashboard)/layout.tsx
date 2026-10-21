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
    <div className="flex min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[70] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:font-medium focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Pular para o conteúdo principal
      </a>

      <Sidebar identity={identity} />

      <div className="flex min-w-0 flex-1 flex-col md:ml-[84px] lg:ml-[232px]">
        <Header identity={identity} />

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-4 pb-[calc(76px+env(safe-area-inset-bottom))] pt-5 focus:outline-none md:px-5 md:py-6 lg:px-8"
        >
          <div className="w-full">{children}</div>
        </main>
      </div>
    </div>
  );
}
