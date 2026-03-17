import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#040611] text-slate-100 selection:bg-cyan-500/25">
      <header className="border-b border-cyan-500/20 bg-[#040611]/90 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 lg:px-8 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center text-slate-950 font-black text-xs">
              SM
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-400/70 font-black">Backoffice</p>
              <h1 className="text-sm font-extrabold tracking-tight text-white">START METRIC ADMIN</h1>
            </div>
          </div>

          <Link
            href="/performance"
            className="text-[11px] uppercase tracking-[0.15em] font-black text-slate-300 border border-white/15 rounded-xl px-3 py-2 hover:border-cyan-400/30 hover:text-cyan-300 transition"
          >
            Voltar ao app
          </Link>
        </div>
      </header>

      {children}
    </div>
  );
}
