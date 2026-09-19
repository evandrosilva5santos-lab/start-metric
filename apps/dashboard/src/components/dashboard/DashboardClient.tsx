"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import {
  TrendingUp,
  DollarSign,
  Target,
  Percent,
  Eye,
  EyeOff,
  RefreshCw,
  Megaphone,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Activity,
  Layers,
  Clock,
  Sparkles,
  MousePointerClick,
  ShoppingCart,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import {
  Button,
  Badge,
  Card,
  EmptyState,
} from "@/components/ui";

type Account = {
  id: string;
  name: string;
  currency: string;
  isActive: boolean;
};

type DailyPoint = {
  date?: string;
  label: string;
  spend: number;
  results: number;
  cpr: number;
  ctr: number;
  impressions: number;
  linkClicks: number;
};

type Campaign = {
  id: string;
  name: string;
  objective: string;
  status: string;
  effective_status: string;
  situacao: "ATIVA" | "PAUSADA" | "SEM_ENTREGA";
  situacaoLabel: string;
  spend: number;
  results: number;
  cpr: number;
  ctr: number;
  cpm: number;
  impressions: number;
  daily_budget: number | null;
  budgetType: string;
};

type FunilEtapa = {
  nome: string;
  valor: number;
  taxa: number;
  isGargalo?: boolean;
};

type Aviso = {
  tipo: "alerta" | "sucesso" | "info";
  titulo: string;
  descricao: string;
  acao: string;
};

type DadosResponse = {
  conta?: { id: string; name: string; currency: string; timezone_name?: string };
  totais?: {
    spend: number;
    results: number;
    cpr: number;
    roas: number;
    ctr: number;
    cpm: number;
    impressions: number;
    linkClicks: number;
    primaryType: string;
  };
  variacao?: {
    spend: number;
    results: number;
    cpr: number;
    roas: number;
    ctr: number;
    cpm: number;
  };
  serieDiaria?: DailyPoint[];
  funil?: FunilEtapa[];
  campanhas?: Campaign[];
  avisos?: Aviso[];
  error?: string;
};

export function DashboardClient() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedRange, setSelectedRange] = useState<string>("last_30d");
  const [data, setData] = useState<DadosResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPrivacyActive, setIsPrivacyActive] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const forceFreshRef = useRef(false);

  // Carregar contas disponíveis
  useEffect(() => {
    fetch("/api/meta/contas")
      .then((res) => res.json())
      .then((json: { contas?: Account[] }) => {
        if (json.contas && json.contas.length > 0) {
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

  // Carregar dados da conta selecionada
  useEffect(() => {
    if (!selectedAccountId) return;
    const controller = new AbortController();
    const freshParam = forceFreshRef.current ? "&fresh=true" : "";
    forceFreshRef.current = false;
    setLoading(true);

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

  const currency = data?.conta?.currency || "BRL";

  const formatBRL = (val: number | undefined) => {
    if (isPrivacyActive) return "R$ •••••";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(val || 0);
  };

  const formatNumber = (val: number | undefined) => {
    if (isPrivacyActive) return "••••";
    return new Intl.NumberFormat("pt-BR").format(val || 0);
  };

  const formatPercent = (val: number | undefined) => {
    if (val === undefined || isNaN(val)) return "0.00%";
    return `${val >= 0 ? "+" : ""}${val.toFixed(2)}%`;
  };

  const totais = data?.totais;
  const variacao = data?.variacao;

  // Formatação do Funil de Conversão
  const funil = useMemo(() => {
    if (data?.funil && data.funil.length > 0) return data.funil;
    const imps = totais?.impressions || 0;
    const clicks = totais?.linkClicks || 0;
    const results = totais?.results || 0;
    return [
      { nome: "Impressões", valor: imps, taxa: 100 },
      { nome: "Cliques no Link", valor: clicks, taxa: imps > 0 ? (clicks / imps) * 100 : 0 },
      { nome: "Resultados Finais", valor: results, taxa: clicks > 0 ? (results / clicks) * 100 : 0 },
    ];
  }, [data, totais]);

  return (
    <div className="space-y-6 lg:space-y-8 animate-in fade-in duration-300">
      
      {/* ── Topbar de Controle: Seletor de Conta, Período e Ações ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-white/5 rounded-2xl p-4 lg:p-5 backdrop-blur-xl">
        <div className="flex flex-wrap items-center gap-3">
          {/* Seletor de Conta Meta */}
          <div className="relative">
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm font-semibold text-white outline-none focus:border-cyan-400 cursor-pointer max-w-[280px] truncate"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id} className="bg-slate-900 text-white">
                  {acc.name} ({acc.id})
                </option>
              ))}
            </select>
          </div>

          {/* Seletor de Período */}
          <select
            value={selectedRange}
            onChange={(e) => setSelectedRange(e.target.value)}
            className="bg-slate-950/80 border border-slate-700/80 rounded-xl px-3.5 py-2 text-sm font-semibold text-white outline-none focus:border-cyan-400 cursor-pointer"
          >
            <option value="today" className="bg-slate-900 text-white">Hoje</option>
            <option value="yesterday" className="bg-slate-900 text-white">Ontem</option>
            <option value="last_7d" className="bg-slate-900 text-white">Últimos 7 dias</option>
            <option value="last_14d" className="bg-slate-900 text-white">Últimos 14 dias</option>
            <option value="last_30d" className="bg-slate-900 text-white">Últimos 30 dias</option>
            <option value="this_month" className="bg-slate-900 text-white">Este mês</option>
            <option value="last_month" className="bg-slate-900 text-white">Mês passado</option>
          </select>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Botão Modo Privacidade (Olho) */}
          <button
            onClick={() => setIsPrivacyActive(!isPrivacyActive)}
            className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors"
            title={isPrivacyActive ? "Mostrar valores" : "Ocultar valores"}
          >
            {isPrivacyActive ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>

          {/* Botão Atualizar */}
          <Button
            onClick={handleRefresh}
            disabled={loading}
            variant="secondary"
            size="sm"
            className="gap-2"
          >
            <RefreshCw size={14} className={loading ? "animate-spin text-cyan-400" : ""} />
            <span>Atualizar</span>
          </Button>
        </div>
      </div>

      {/* ── 4 Big KPI Cards com Cores e Badges de Variação ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        
        {/* 1. Investido */}
        <Card className="p-5 relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-950/90 border-white/5 group hover:border-cyan-500/30 transition-all">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Total Investido</span>
            {variacao?.spend !== undefined && (
              <Badge variant={variacao.spend <= 0 ? "roi" : "secondary"}>
                {formatPercent(variacao.spend)}
              </Badge>
            )}
          </div>
          <div className="text-2xl lg:text-3xl font-black text-white tracking-tight mb-1">
            {formatBRL(totais?.spend)}
          </div>
          <div className="text-xs text-slate-400">
            Total gasto no período selecionado
          </div>
        </Card>

        {/* 2. Resultados */}
        <Card className="p-5 relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-950/90 border-white/5 group hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              {totais?.primaryType ? `Resultados (${totais.primaryType})` : "Resultados"}
            </span>
            {variacao?.results !== undefined && (
              <Badge variant={variacao.results >= 0 ? "roi" : "warning"}>
                {formatPercent(variacao.results)}
              </Badge>
            )}
          </div>
          <div className="text-2xl lg:text-3xl font-black text-emerald-400 tracking-tight mb-1">
            {formatNumber(totais?.results)}
          </div>
          <div className="text-xs text-slate-400">
            Conversões principais desduplicadas
          </div>
        </Card>

        {/* 3. CPR (Custo por Resultado) */}
        <Card className="p-5 relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-950/90 border-white/5 group hover:border-indigo-500/30 transition-all">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Custo por Resultado</span>
            {variacao?.cpr !== undefined && (
              <Badge variant={variacao.cpr <= 0 ? "roi" : "warning"}>
                {formatPercent(variacao.cpr)}
              </Badge>
            )}
          </div>
          <div className="text-2xl lg:text-3xl font-black text-cyan-300 tracking-tight mb-1">
            {formatBRL(totais?.cpr)}
          </div>
          <div className="text-xs text-slate-400">
            Custo médio por conversão gerada
          </div>
        </Card>

        {/* 4. ROAS (Retorno) */}
        <Card className="p-5 relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-950/90 border-white/5 group hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Retorno (ROAS)</span>
            {variacao?.roas !== undefined && (
              <Badge variant={variacao.roas >= 0 ? "roi" : "secondary"}>
                {formatPercent(variacao.roas)}
              </Badge>
            )}
          </div>
          <div className="text-2xl lg:text-3xl font-black text-amber-400 tracking-tight mb-1">
            {isPrivacyActive ? "••••" : `${(totais?.roas || 0).toFixed(2)}x`}
          </div>
          <div className="text-xs text-slate-400">
            Multiplicador de faturamento
          </div>
        </Card>

      </div>

      {/* ── 4 Pílulas de Métricas Secundárias ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/40 border border-white/5 rounded-xl p-3.5 flex flex-col">
          <span className="text-xs font-semibold text-slate-400 mb-1">CTR do Link</span>
          <span className="text-lg font-bold text-white mb-0.5">{totais?.ctr?.toFixed(2) || "0.00"}%</span>
          <span className="text-[11px] text-slate-500">Taxa de cliques</span>
        </div>
        <div className="bg-slate-900/40 border border-white/5 rounded-xl p-3.5 flex flex-col">
          <span className="text-xs font-semibold text-slate-400 mb-1">CPM Médio</span>
          <span className="text-lg font-bold text-white mb-0.5">{formatBRL(totais?.cpm)}</span>
          <span className="text-[11px] text-slate-500">Por 1.000 impressões</span>
        </div>
        <div className="bg-slate-900/40 border border-white/5 rounded-xl p-3.5 flex flex-col">
          <span className="text-xs font-semibold text-slate-400 mb-1">Impressões</span>
          <span className="text-lg font-bold text-white mb-0.5">{formatNumber(totais?.impressions)}</span>
          <span className="text-[11px] text-slate-500">Visualizações totais</span>
        </div>
        <div className="bg-slate-900/40 border border-white/5 rounded-xl p-3.5 flex flex-col">
          <span className="text-xs font-semibold text-slate-400 mb-1">Cliques no Link</span>
          <span className="text-lg font-bold text-white mb-0.5">{formatNumber(totais?.linkClicks)}</span>
          <span className="text-[11px] text-slate-500">Tráfego direcionado</span>
        </div>
      </div>

      {/* ── Gráfico de Evolução Diária & Funil de Conversão ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Painel do Gráfico (8 colunas) */}
        <Card className="lg:col-span-8 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-white">Evolução Diária</h3>
              <p className="text-xs text-slate-400">Investimento (R$) vs Resultados dia a dia</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <span className="flex items-center gap-1.5 text-cyan-400">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
                Investimento
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                Resultados
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            {data?.serieDiaria && data.serieDiaria.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.serieDiaria} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorResults" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="label" stroke="#64748b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#020617", borderColor: "#334155", borderRadius: "12px", color: "#fff" }}
                    formatter={(val: unknown, name: unknown) => [
                      name === "spend" ? (isPrivacyActive ? "R$ •••••" : `R$ ${Number(val || 0).toFixed(2)}`) : Number(val || 0),
                      name === "spend" ? "Investido" : "Resultados",
                    ]}
                  />
                  <Area type="monotone" dataKey="spend" stroke="#22d3ee" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSpend)" />
                  <Area type="monotone" dataKey="results" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorResults)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                Nenhum dado diário disponível para o período selecionado.
              </div>
            )}
          </div>
        </Card>

        {/* Funil de Conversão Tático (4 colunas) */}
        <Card className="lg:col-span-4 p-5 lg:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-white">Funil de Conversão</h3>
              <Badge variant="default">Gargalos</Badge>
            </div>
            <p className="text-xs text-slate-400 mb-6">Eficiência entre etapas de tráfego e vendas</p>

            <div className="space-y-4">
              {funil.map((etapa, idx) => (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-300">{etapa.nome}</span>
                    <span className="font-bold text-white">
                      {isPrivacyActive ? "••••" : formatNumber(etapa.valor)}
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/5">
                    <div
                      className={`h-full rounded-full ${
                        idx === 0
                          ? "bg-cyan-400"
                          : idx === 1
                            ? "bg-indigo-400"
                            : "bg-emerald-400"
                      }`}
                      style={{ width: `${Math.min(Math.max(etapa.taxa, 5), 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
            <span>Conversão Global:</span>
            <span className="font-bold text-emerald-400">
              {totais?.impressions && totais?.results
                ? `${((totais.results / totais.impressions) * 100).toFixed(3)}%`
                : "0.00%"}
            </span>
          </div>
        </Card>

      </div>

      {/* ── Top Campanhas & Diagnóstico Inteligente ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Lista das Top Campanhas (7 colunas) */}
        <Card className="lg:col-span-7 p-5 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white">Principais Campanhas</h3>
              <p className="text-xs text-slate-400">Métricas consolidadas da conta</p>
            </div>
            <Link href="/campaigns">
              <Button variant="secondary" size="sm" className="gap-1.5 text-xs">
                <span>Ver Split-View</span>
                <ArrowRight size={14} />
              </Button>
            </Link>
          </div>

          <div className="divide-y divide-white/5">
            {data?.campanhas && data.campanhas.length > 0 ? (
              data.campanhas.slice(0, 5).map((camp) => (
                <div key={camp.id} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0 max-w-[260px]">
                    <div className="font-bold text-sm text-white truncate">{camp.name}</div>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>{camp.objective?.replace("OUTCOME_", "") || "Vendas"}</span>
                      <span>·</span>
                      <span className="font-semibold text-emerald-400">{camp.results} resultados</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-bold text-sm text-white">{formatBRL(camp.spend)}</div>
                    <div className="text-xs text-slate-400">CPR: {formatBRL(camp.cpr)}</div>
                  </div>

                  <div className="shrink-0">
                    <Badge variant={camp.situacao === "ATIVA" ? "roi" : "secondary"}>
                      {camp.situacaoLabel}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-500 text-sm">
                Nenhuma campanha encontrada nesta conta.
              </div>
            )}
          </div>
        </Card>

        {/* Diagnóstico Inteligente em Português (5 colunas) */}
        <Card className="lg:col-span-5 p-5 lg:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={18} className="text-cyan-400" />
              <h3 className="text-base font-bold text-white">Diagnóstico Inteligente</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">Recomendações táticas em tempo real</p>

            <div className="space-y-3">
              {data?.avisos && data.avisos.length > 0 ? (
                data.avisos.map((aviso, idx) => (
                  <div
                    key={idx}
                    className={`p-3 rounded-xl border text-xs space-y-1 ${
                      aviso.tipo === "alerta"
                        ? "bg-amber-500/10 border-amber-500/20 text-amber-300"
                        : aviso.tipo === "sucesso"
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
                          : "bg-cyan-500/10 border-cyan-500/20 text-cyan-300"
                    }`}
                  >
                    <div className="font-bold">{aviso.titulo}</div>
                    <div className="text-slate-300 text-[11px] leading-relaxed">{aviso.descricao}</div>
                  </div>
                ))
              ) : (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-300 text-xs space-y-1">
                  <div className="font-bold">Contas Operando com Eficiência</div>
                  <div className="text-slate-300 text-[11px]">
                    Não foram detectados desvios críticos de CPR ou taxa de entrega no período selecionado.
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
            <span className="text-slate-400">Status da API Meta:</span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Operacional v21.0
            </span>
          </div>
        </Card>

      </div>

    </div>
  );
}
