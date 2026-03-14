"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="glass rounded-2xl p-8 max-w-lg w-full border border-red-500/30">
        <h2 className="text-xl font-bold text-red-300 mb-3">Erro de runtime</h2>
        <p className="text-sm text-slate-300 mb-5">{error.message || "Erro inesperado no dashboard."}</p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-sm hover:bg-cyan-500/30 transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
