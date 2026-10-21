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
      <div className="glass rounded-2xl p-8 max-w-lg w-full border border-danger/30">
        <h2 className="text-xl font-bold text-danger mb-3">Erro de runtime</h2>
        <p className="text-sm text-fg mb-5">{error.message || "Erro inesperado no dashboard."}</p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-xl bg-primary-tint border border-primary/40 text-primary text-sm hover:bg-primary-tint transition-colors"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}
