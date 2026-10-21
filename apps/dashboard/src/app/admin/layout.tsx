import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-fg selection:bg-primary-tint">
      <header className="border-b border-primary/20 bg-surface">
        <div className="mx-auto max-w-7xl px-4 lg:px-8 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary flex items-center justify-center text-primary-fg font-black text-xs">
              SM
            </div>
            <div>
              <p className="text-[12px] uppercase tracking-[0.18em] text-primary font-black">Backoffice</p>
              <h1 className="text-sm font-extrabold tracking-tight text-fg">START METRIC ADMIN</h1>
            </div>
          </div>

          <Link
            href="/performance"
            className="text-[12px] uppercase tracking-[0.15em] font-black text-fg border border-border rounded-xl px-3 py-2 hover:border-primary/30 hover:text-primary transition"
          >
            Voltar ao app
          </Link>
        </div>
      </header>

      {children}
    </div>
  );
}
