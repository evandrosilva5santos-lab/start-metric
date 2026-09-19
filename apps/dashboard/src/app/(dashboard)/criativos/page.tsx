"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  ImageIcon,
  Zap,
  Play,
  Eye,
  EyeOff,
  RefreshCw,
  Award,
  AlertTriangle,
} from "lucide-react";
import {
  Button,
  Badge,
  Card,
  EmptyState,
} from "@/components/ui";

type Creative = {
  id: string;
  name: string;
  campaign_id: string;
  campaign_name: string;
  spend: number;
  results: number;
  cpr: number;
  ctr: number;
  impressions: number;
  isVideo: boolean;
  video3s: number;
  videoP100: number;
  hookRate: number;
  retentionRate: number;
  thumbnail: string | null;
  title: string;
  body: string;
};

type Account = {
  id: string;
  name: string;
  currency: string;
  isActive: boolean;
};

type SortOption = "spend" | "results" | "hook" | "ctr" | "cpr";

type DadosResponse = {
  conta?: { id: string; name: string; currency: string };
  totais?: { cpr: number };
  criativos?: Creative[];
  error?: string;
};

export default function CriativosPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedRange, setSelectedRange] = useState<string>("last_30d");
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<DadosResponse | null>(null);
  const [sortOption, setSortOption] = useState<SortOption>("spend");
  const [isPrivacyActive, setIsPrivacyActive] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const forceFreshRef = useRef(false);

  useEffect(() => {
    fetch("/api/meta/contas")
      .then((res) => res.json())
      .then((json: { contas?: Account[] }) => {
        if (json.contas) {
          setAccounts(json.contas);
          const found = json.contas.find((c) => c.isActive) || json.contas[0];
          if (found) {
            setLoading(true);
            setSelectedAccountId(found.id);
          }
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedAccountId) return;
    const controller = new AbortController();
    const freshParam = forceFreshRef.current ? "&fresh=true" : "";
    forceFreshRef.current = false;
    fetch(`/api/meta/dados?account_id=${selectedAccountId}&range=${selectedRange}${freshParam}`, {
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((json: DadosResponse) => {
        if (!json.error) {
          setData(json);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selectedAccountId, selectedRange, refreshKey]);

  const handleRefresh = () => {
    setLoading(true);
    forceFreshRef.current = true;
    setRefreshKey((k) => k + 1);
  };

  const creatives = useMemo(() => {
    const rawCreatives: Creative[] = data?.criativos || [];
    const list = [...rawCreatives];
    list.sort((a, b) => {
      if (sortOption === "results") return b.results - a.results;
      if (sortOption === "hook") return b.hookRate - a.hookRate;
      if (sortOption === "ctr") return b.ctr - a.ctr;
      if (sortOption === "cpr") return (a.cpr || 9999) - (b.cpr || 9999);
      return b.spend - a.spend;
    });
    return list;
  }, [data, sortOption]);

  const formatBRL = (val: number) => {
    if (isPrivacyActive) return "R$ •••••";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: data?.conta?.currency || "BRL" }).format(val || 0);
  };

  const avgCpr = data?.totais?.cpr || 0;

  return (
    <main className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header com Filtros de Conta e Ordenação */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-white/5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-cyan-400 font-black text-[10px] tracking-[0.2em] uppercase">
            <Zap size={12} fill="currentColor" />
            <span>Inteligência de Criativos</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Análise de <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-500">Criativos</span>
            {data?.conta && (
              <Badge variant="default" pulseDot>
                {data.conta.name}
              </Badge>
            )}
          </h1>
          <p className="text-slate-400 text-sm max-w-2xl">
            Rastreie o ROI, taxa de retenção nos 3 primeiros segundos e sinal de fadiga de cada criativo.
          </p>
        </div>

        {/* Controles de Topo */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Conta */}
          <select
            value={selectedAccountId}
            onChange={(e) => { setLoading(true); setSelectedAccountId(e.target.value); }}
            aria-label="Selecione a conta de anúncios"
            className="bg-slate-900/90 border border-slate-800 text-white text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:border-cyan-500 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.isActive ? "● " : "○ "}
                {acc.name} ({acc.currency})
              </option>
            ))}
          </select>

          {/* Seletor de Período */}
          <select
            value={selectedRange}
            onChange={(e) => { setLoading(true); setSelectedRange(e.target.value); }}
            aria-label="Selecione o período de análise"
            className="bg-slate-900/90 border border-slate-800 text-white text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:border-cyan-500 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <option value="last_7d">7 dias</option>
            <option value="last_14d">14 dias</option>
            <option value="last_30d">30 dias</option>
          </select>

          {/* Ordenar por */}
          <select
            value={sortOption}
            onChange={(e) => setSortOption(e.target.value as SortOption)}
            aria-label="Ordenar criativos por métrica"
            className="bg-slate-900/90 border border-slate-800 text-cyan-400 text-xs font-bold rounded-xl px-3 py-2 outline-none focus:border-cyan-500 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <option value="spend">Maior Gasto</option>
            <option value="results">Mais Resultados</option>
            <option value="hook">Melhor Gancho (3s)</option>
            <option value="ctr">Maior CTR</option>
            <option value="cpr">Menor Custo/Res.</option>
          </select>

          {/* Botão Refresh */}
          <Button
            onClick={handleRefresh}
            disabled={loading}
            variant="outline"
            size="icon"
            aria-label="Atualizar dados de criativos"
            title="Atualizar"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-cyan-400" : ""} />
          </Button>

          {/* Modo Privacidade */}
          <Button
            onClick={() => setIsPrivacyActive(!isPrivacyActive)}
            variant="outline"
            size="icon"
            aria-label={isPrivacyActive ? "Mostrar valores monetários" : "Ocultar valores monetários"}
            title="Ocultar valores em R$"
          >
            {isPrivacyActive ? <EyeOff size={15} /> : <Eye size={15} />}
          </Button>
        </div>
      </header>

      {/* Grid de Cards de Criativos */}
      {loading && creatives.length === 0 ? (
        <div className="p-16 text-center text-slate-500 text-sm">Carregando métricas individuais dos criativos...</div>
      ) : creatives.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title="Nenhum criativo com entrega"
          description="Nenhum anúncio veiculou impressões no período selecionado. Experimente alterar o período ou sincronizar com a Meta."
          action={{
            label: "Sincronizar Dados",
            onClick: handleRefresh,
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {creatives.map((c) => {
            const isWinner = c.results > 15 && c.cpr < avgCpr;
            const isFatigued = c.spend > 150 && c.ctr < 0.6;

            return (
              <Card
                key={c.id}
                className="overflow-hidden flex flex-col hover:border-slate-700 transition-all hover:-translate-y-1 p-0 group"
              >
                {/* Preview Thumbnail */}
                <div className="h-48 bg-slate-950 relative flex items-center justify-center overflow-hidden border-b border-white/5">
                  {c.thumbnail ? (
                    <img
                      src={c.thumbnail}
                      alt={c.name}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="text-slate-600 text-xs font-semibold flex items-center gap-1.5">
                      <ImageIcon size={18} />
                      <span>Sem prévia de imagem</span>
                    </div>
                  )}

                  {/* Badges de Destaque */}
                  <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                    {isWinner && (
                      <Badge variant="roi" pulseDot className="bg-emerald-500/90 text-slate-950 font-black shadow-[0_0_15px_rgba(16,185,129,0.5)]">
                        <Award size={12} className="mr-1" /> Campeão
                      </Badge>
                    )}
                    {isFatigued && (
                      <Badge variant="destructive" className="bg-rose-500/90 text-white font-black shadow-[0_0_15px_rgba(244,63,94,0.5)]">
                        <AlertTriangle size={12} className="mr-1" /> Cansado
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Conteúdo do Card */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div>
                    <h3 className="text-sm font-bold text-white line-clamp-2 leading-snug" title={c.name}>
                      {c.name}
                    </h3>
                    <div className="text-xs text-slate-500 truncate mt-1">
                      {c.campaign_name || "Campanha Meta"}
                    </div>
                  </div>

                  {/* 3 Métricas Rápidas */}
                  <div className="grid grid-cols-3 gap-2 bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 text-center">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Gasto</div>
                      <div className="text-sm font-black text-white mt-0.5 font-mono">{formatBRL(c.spend)}</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Resultados</div>
                      <div className="text-sm font-black text-cyan-400 mt-0.5 font-mono">
                        {isPrivacyActive ? "••••" : c.results}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase">CTR Link</div>
                      <div className="text-sm font-black text-white mt-0.5 font-mono">{c.ctr.toFixed(2)}%</div>
                    </div>
                  </div>

                  {/* Métricas de Vídeo (Gancho 3s & Retenção 100%) */}
                  {c.isVideo && (
                    <div className="space-y-2.5 bg-slate-900/40 border border-slate-800/60 rounded-xl p-3">
                      <div>
                        <div className="flex justify-between items-center text-xs text-slate-300">
                          <span className="font-medium flex items-center gap-1">
                            <Play size={10} className="text-cyan-400" /> Gancho 3 seg (Hook Rate)
                          </span>
                          <span className="font-extrabold text-cyan-400 font-mono">{c.hookRate.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5">
                          <div
                            style={{ width: `${Math.min(c.hookRate, 100)}%` }}
                            className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-500"
                          ></div>
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between items-center text-xs text-slate-300">
                          <span className="font-medium">Retenção até o Fim (100%)</span>
                          <span className="font-extrabold text-indigo-400 font-mono">{c.retentionRate.toFixed(1)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5">
                          <div
                            style={{ width: `${Math.min(c.retentionRate, 100)}%` }}
                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                          ></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Custo por Resultado */}
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
                    <span className="text-slate-400 font-medium">Custo por Resultado:</span>
                    <span className="text-sm font-black text-white font-mono">
                      {c.results > 0 ? formatBRL(c.cpr) : "—"}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

    </main>
  );
}
