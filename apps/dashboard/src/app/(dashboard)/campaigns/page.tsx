"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  Megaphone,
  Search,
  RefreshCw,
  Eye,
  EyeOff,
  Inbox
} from "lucide-react";
import {
  Button,
  Badge,
  Card,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  EmptyState,
} from "@/components/ui";

type Campaign = {
  id: string;
  name: string;
  objective: string;
  status: string;
  effective_status: string;
  situacao: "ATIVA" | "PAUSADA" | "SEM_ENTREGA";
  situacaoLabel: string;
  situacaoColor: string;
  spend: number;
  results: number;
  cpr: number;
  ctr: number;
  cpm: number;
  impressions: number;
  daily_budget: number | null;
  budgetType: string;
  adsets: AdsetDetail[];
  ads: AdDetail[];
};

type AdsetDetail = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  learning_stage: string;
  optimization_goal: string;
};

type AdDetail = {
  id: string;
  name: string;
  adset_id: string;
  status: string;
  effective_status: string;
  creative: {
    id: string;
    name: string;
    thumbnail_url: string;
    title: string;
    body: string;
  } | null;
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

type DadosResponse = {
  conta?: { id: string; name: string; currency: string };
  totais?: { spend: number; results: number; cpr: number; roas: number; ctr: number; cpm: number; primaryType: string };
  serieDiaria?: DailyPoint[];
  campanhas?: Campaign[];
  error?: string;
};

type Account = {
  id: string;
  name: string;
  currency: string;
  isActive: boolean;
};

export default function CampaignsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");
  const [selectedRange, setSelectedRange] = useState<string>("last_30d");
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<DadosResponse | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [filterPill, setFilterPill] = useState<"todas" | "ativas" | "pausadas" | "atencao">("todas");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activeTab, setActiveTab] = useState<string>("resumo");
  const [budgetInput, setBudgetInput] = useState<string>("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [isSavingBudget, setIsSavingBudget] = useState<boolean>(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [isPrivacyActive, setIsPrivacyActive] = useState<boolean>(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const forceFreshRef = useRef(false);

  // Carregar contas disponíveis
  useEffect(() => {
    fetch("/api/meta/contas")
      .then((res) => res.json())
      .then((json) => {
        if (json.contas) {
          setAccounts(json.contas);
          const found = (json.contas as Account[]).find((c: Account) => c.isActive) || json.contas[0];
          if (found) {
            setLoading(true);
            setSelectedAccountId(found.id);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Carregar dados da conta selecionada. O AbortController cancela requisições
  // obsoletas quando conta/período mudam rápido (evita resposta antiga sobrescrever nova).
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
        if (json.error) return;
        setData(json);
        const camps = json.campanhas;
        if (camps && camps.length > 0) {
          const validCamps = camps;
          setSelectedCampaignId((prev) => {
            if (prev && validCamps.some((c) => c.id === prev)) return prev;
            return validCamps[0].id;
          });
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

  const campaigns: Campaign[] = data?.campanhas || [];

  // Contadores
  const countAll = campaigns.length;
  const countActive = campaigns.filter((c) => c.situacao === "ATIVA").length;
  const countPaused = campaigns.filter((c) => c.situacao === "PAUSADA").length;
  const countAlert = campaigns.filter((c) => c.situacao === "SEM_ENTREGA" || (c.results === 0 && c.spend > 100)).length;

  // Filtragem
  const filteredCampaigns = useMemo(() => {
    const campaigns: Campaign[] = data?.campanhas || [];
    return campaigns.filter((c) => {
      if (filterPill === "ativas" && c.situacao !== "ATIVA") return false;
      if (filterPill === "pausadas" && c.situacao !== "PAUSADA") return false;
      if (filterPill === "atencao" && !(c.situacao === "SEM_ENTREGA" || (c.results === 0 && c.spend > 100))) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return c.name.toLowerCase().includes(q) || (c.objective || "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [data, filterPill, searchQuery]);

  // Campanha selecionada
  const selectedCampaign = useMemo(() => {
    const campaigns: Campaign[] = data?.campanhas || [];
    return campaigns.find((c) => c.id === selectedCampaignId) || campaigns[0] || null;
  }, [data, selectedCampaignId]);

  useEffect(() => {
    if (selectedCampaign) {
      setBudgetInput(selectedCampaign.daily_budget ? selectedCampaign.daily_budget.toFixed(2) : "0.00");
    }
  }, [selectedCampaign]);

  // Formatters
  const formatBRL = (val: number) => {
    if (isPrivacyActive) return "R$ •••••";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: data?.conta?.currency || "BRL" }).format(val || 0);
  };

  // Toggle de Situação
  const handleToggleStatus = async () => {
    if (!selectedCampaign) return;
    const currentStatus = selectedCampaign.status || "PAUSED";
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";

    setIsUpdatingStatus(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch("/api/meta/campanha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedCampaign.id, status: newStatus }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        selectedCampaign.status = newStatus;
        selectedCampaign.effective_status = newStatus;
        selectedCampaign.situacao = newStatus === "ACTIVE" ? (selectedCampaign.spend > 0 ? "ATIVA" : "SEM_ENTREGA") : "PAUSADA";
        selectedCampaign.situacaoLabel = newStatus === "ACTIVE" ? "Ativa" : "Pausada";
        setFeedbackMsg({ text: `Campanha ${newStatus === "ACTIVE" ? "ATIVADA" : "PAUSADA"} com sucesso na Meta!`, type: "success" });
        setData({ ...data });
      } else {
        setFeedbackMsg({ text: json.error || "Erro ao atualizar status", type: "error" });
      }
    } catch {
      setFeedbackMsg({ text: "Falha de conexão com a Meta", type: "error" });
    } finally {
      setIsUpdatingStatus(false);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  // Salvar Orçamento
  const handleSaveBudget = async () => {
    if (!selectedCampaign) return;
    const num = parseFloat(budgetInput);
    if (isNaN(num) || num <= 0) {
      setFeedbackMsg({ text: "Informe um valor válido", type: "error" });
      return;
    }

    setIsSavingBudget(true);
    setFeedbackMsg(null);
    try {
      const res = await fetch("/api/meta/campanha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedCampaign.id, daily_budget: num }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        selectedCampaign.daily_budget = num;
        setFeedbackMsg({ text: `Orçamento diário atualizado para R$ ${num.toFixed(2)} na Meta!`, type: "success" });
        setData({ ...data });
      } else {
        setFeedbackMsg({ text: json.error || "Erro ao salvar orçamento", type: "error" });
      }
    } catch {
      setFeedbackMsg({ text: "Falha de conexão com a Meta", type: "error" });
    } finally {
      setIsSavingBudget(false);
      setTimeout(() => setFeedbackMsg(null), 4000);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      
      {/* Header com Contas, Busca e Período */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/5">
        <div>
          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs tracking-wider uppercase mb-1">
            <Megaphone size={14} />
            <span>Gestor de Anúncios Meta</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            Campanhas
            {data?.conta && (
              <Badge variant="roi" pulseDot>
                {data.conta.name}
              </Badge>
            )}
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Acompanhe, analise e ajuste sem abrir o Gerenciador. <span className="text-slate-600 italic">— ADZ</span>
          </p>
        </div>

        {/* Controles de Topo */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Seletor de Conta */}
          <select
            value={selectedAccountId}
            onChange={(e) => { setLoading(true); setSelectedAccountId(e.target.value); }}
            aria-label="Selecione a conta de anúncios"
            className="bg-slate-900/90 border border-slate-800 text-white text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:border-emerald-500 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
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
            className="bg-slate-900/90 border border-slate-800 text-white text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:border-emerald-500 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <option value="today">Hoje</option>
            <option value="yesterday">Ontem</option>
            <option value="last_7d">7 dias</option>
            <option value="last_14d">14 dias</option>
            <option value="last_30d">30 dias</option>
            <option value="this_month">Este mês</option>
            <option value="last_month">Mês passado</option>
          </select>

          {/* Botão Atualizar */}
          <Button
            onClick={handleRefresh}
            disabled={loading}
            variant="outline"
            size="icon"
            aria-label="Sincronizar com a Meta"
            title="Sincronizar com a Meta"
          >
            <RefreshCw size={15} className={loading ? "animate-spin text-emerald-400" : ""} />
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
      </div>

      {/* Feedback Alert */}
      {feedbackMsg && (
        <div
          role="alert"
          className={`p-3 rounded-xl border text-sm font-medium animate-in fade-in ${
            feedbackMsg.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/30 text-rose-300"
          }`}
        >
          {feedbackMsg.text}
        </div>
      )}

      {/* Filtros em Pills e Busca */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Filtro por situação da campanha">
          <button
            type="button"
            onClick={() => setFilterPill("todas")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              filterPill === "todas"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white"
            }`}
          >
            Todas <span className="opacity-70 ml-1">{countAll}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterPill("ativas")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              filterPill === "ativas"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Ativas <span className="opacity-70 ml-0.5">{countActive}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterPill("pausadas")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              filterPill === "pausadas"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white"
            }`}
          >
            Pausadas <span className="opacity-70 ml-1">{countPaused}</span>
          </button>

          <button
            type="button"
            onClick={() => setFilterPill("atencao")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
              filterPill === "atencao"
                ? "bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                : "bg-slate-900/60 text-slate-400 border border-slate-800 hover:text-white"
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            Precisam de você <span className="opacity-70 ml-0.5">{countAlert}</span>
          </button>
        </div>

        {/* Input de Busca */}
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar campanha..."
            aria-label="Buscar campanha por nome ou objetivo"
            className="w-full bg-slate-900/80 border border-slate-800 rounded-full pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
          />
        </div>
      </div>

      {/* ========================================================= */}
      {/* SPLIT VIEW (Duas Colunas: Lista na Esquerda, Detalhe na Direita) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[580px]">
        
        {/* COLUNA ESQUERDA: Lista de Campanhas (5 colunas) */}
        <Card className="lg:col-span-5 flex flex-col overflow-hidden p-0">
          <div className="flex justify-between items-center px-4 py-3 border-b border-white/5 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-950/40">
            <span>Campanha</span>
            <span>Situação</span>
          </div>

          <div className="overflow-y-auto flex-1 divide-y divide-white/5 max-h-[620px] custom-scrollbar" role="list" aria-label="Lista de Campanhas">
            {loading && campaigns.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">Carregando campanhas da Meta...</div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  title="Nenhuma campanha encontrada"
                  description="Ajuste os filtros de pesquisa ou sincronize novamente os dados da Meta."
                  action={{
                    label: "Limpar Filtros",
                    onClick: () => {
                      setFilterPill("todas");
                      setSearchQuery("");
                    },
                  }}
                />
              </div>
            ) : (
              filteredCampaigns.map((camp) => {
                const isSelected = camp.id === selectedCampaign?.id;
                const budgetText = camp.daily_budget ? `R$ ${camp.daily_budget.toFixed(2)}/dia` : "Orçamento Conjunto";

                return (
                  <div
                    key={camp.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => setSelectedCampaignId(camp.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedCampaignId(camp.id);
                      }
                    }}
                    className={`p-4 flex items-center justify-between gap-3 cursor-pointer transition-all border-l-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                      isSelected
                        ? "bg-emerald-950/20 border-emerald-400"
                        : "border-transparent hover:bg-slate-900/40"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-white truncate leading-snug" title={camp.name}>
                        {camp.name}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span className="capitalize">{camp.objective?.replace("OUTCOME_", "").toLowerCase() || "Anúncios"}</span>
                        <span>•</span>
                        <span className="font-semibold text-slate-300">{budgetText}</span>
                      </div>
                    </div>

                    <div className="flex-shrink-0">
                      {camp.situacao === "ATIVA" ? (
                        <Badge variant="roi" pulseDot>
                          Ativa
                        </Badge>
                      ) : camp.situacao === "SEM_ENTREGA" ? (
                        <Badge variant="warning" pulseDot>
                          Sem entrega
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          Pausada
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* COLUNA DIREITA: Detalhes e Edição da Campanha Selecionada (7 colunas) */}
        <Card className="lg:col-span-7 p-5 md:p-6 flex flex-col">
          {!selectedCampaign ? (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
              <EmptyState
                icon={Inbox}
                title="Selecione uma campanha"
                description="Escolha uma campanha na lista ao lado para visualizar métricas detalhadas, conjuntos e anúncios."
              />
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Topo do Detalhe: Nome, Situação e Botão Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-white/5">
                <div className="space-y-1 max-w-lg">
                  <h2 className="text-xl font-bold text-white leading-snug">{selectedCampaign.name}</h2>
                  <div className="text-xs text-slate-400">
                    {selectedCampaign.objective?.replace("OUTCOME_", "") || "Vendas"} · {data?.conta?.name || "Conta Meta"}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {selectedCampaign.status === "ACTIVE" ? (
                    <Badge variant="roi" pulseDot>
                      Ativa
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      Pausada
                    </Badge>
                  )}

                  {/* Botão de Toggle da Situação */}
                  <Button
                    onClick={handleToggleStatus}
                    disabled={isUpdatingStatus}
                    loading={isUpdatingStatus}
                    variant={selectedCampaign.status === "ACTIVE" ? "secondary" : "roi"}
                    size="sm"
                  >
                    {selectedCampaign.status === "ACTIVE" ? "Pausar Campanha" : "Ativar Campanha"}
                  </Button>
                </div>
              </div>

              {/* Barra de Edição de Orçamento Diário */}
              <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Badge variant="default">
                    {selectedCampaign.budgetType}
                  </Badge>
                  <span className="text-xs font-semibold text-slate-300">Orçamento Diário:</span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">R$</span>
                    <input
                      type="number"
                      step="1.00"
                      min="1"
                      value={budgetInput}
                      onChange={(e) => setBudgetInput(e.target.value)}
                      aria-label="Orçamento diário em Reais"
                      className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-2.5 py-1 text-sm font-bold text-white w-28 outline-none focus:border-emerald-500 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400"
                    />
                  </div>

                  <Button
                    onClick={handleSaveBudget}
                    disabled={isSavingBudget}
                    loading={isSavingBudget}
                    variant="roi"
                    size="sm"
                  >
                    Salvar na Meta
                  </Button>
                </div>
              </div>

              {/* Abas Internas do Detalhe (Tabs shadcn) */}
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="bg-slate-900/60 border border-white/5">
                  <TabsTrigger value="resumo">
                    Resumo
                  </TabsTrigger>
                  <TabsTrigger value="conjuntos" className="gap-1.5">
                    Conjuntos
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {selectedCampaign.adsets?.length || 0}
                    </span>
                  </TabsTrigger>
                  <TabsTrigger value="anuncios" className="gap-1.5">
                    Anúncios
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300">
                      {selectedCampaign.ads?.length || 0}
                    </span>
                  </TabsTrigger>
                </TabsList>

                {/* ABA RESUMO */}
                <TabsContent value="resumo">
                  <div className="space-y-4">
                    {/* 4 Cards Rápidos */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Gasto</div>
                        <div className="text-lg font-black text-white mt-1 font-mono">{formatBRL(selectedCampaign.spend)}</div>
                      </div>

                      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">
                          {selectedCampaign.objective?.includes("LEAD") ? "Leads" : "Resultados"}
                        </div>
                        <div className="text-lg font-black text-white mt-1 font-mono">
                          {isPrivacyActive ? "••••" : selectedCampaign.results}
                        </div>
                      </div>

                      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Custo / Res.</div>
                        <div className="text-lg font-black text-white mt-1 font-mono">
                          {selectedCampaign.results > 0 ? formatBRL(selectedCampaign.cpr) : "—"}
                        </div>
                      </div>

                      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-3.5">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">CTR do Link</div>
                        <div className="text-lg font-black text-emerald-400 mt-1 font-mono">
                          {selectedCampaign.ctr.toFixed(2)}%
                        </div>
                      </div>
                    </div>

                    {/* Gráfico Curva de Gasto Dia a Dia */}
                    <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4">
                      <div className="text-xs font-bold text-slate-400 mb-3">Gasto dia a dia</div>
                      <div className="h-32 w-full flex items-end gap-1 pt-4">
                        {data?.serieDiaria && data.serieDiaria.length > 0 && (() => {
                          const serie: Array<{ spend: number; label: string }> = data.serieDiaria;
                          const maxSpend = Math.max(...serie.map((s) => s.spend), 1);
                          return serie.map((d, idx) => {
                            const heightPct = Math.max(8, (d.spend / maxSpend) * 100);
                            return (
                              <div
                                key={idx}
                                className="flex-1 flex flex-col items-center group relative h-full justify-end"
                              >
                                <div
                                  style={{ height: `${heightPct}%` }}
                                  className="w-full bg-gradient-to-t from-emerald-500/30 to-emerald-400 rounded-t transition-all group-hover:from-emerald-400 group-hover:to-emerald-300"
                                ></div>
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-slate-900 border border-slate-700 text-[10px] text-white px-1.5 py-0.5 rounded whitespace-nowrap z-10 pointer-events-none shadow-lg">
                                  {d.label}: R$ {d.spend.toFixed(0)}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* ABA CONJUNTOS */}
                <TabsContent value="conjuntos">
                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto custom-scrollbar">
                    {selectedCampaign.adsets?.length === 0 ? (
                      <div className="text-slate-500 text-xs py-8 text-center">Nenhum conjunto encontrado</div>
                    ) : (
                      selectedCampaign.adsets?.map((adset) => (
                        <div
                          key={adset.id}
                          className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="text-sm font-bold text-white">{adset.name}</div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              Fase: <span className="font-semibold text-slate-300">{adset.learning_stage}</span> · Meta: {adset.optimization_goal}
                            </div>
                          </div>

                          <div className="text-right">
                            {adset.status === "ACTIVE" ? (
                              <Badge variant="roi" pulseDot>
                                Ativo
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                Pausado
                              </Badge>
                            )}
                            <div className="text-xs text-slate-300 font-bold mt-1 font-mono">
                              {adset.daily_budget ? `R$ ${adset.daily_budget.toFixed(2)}/dia` : "CBO"}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                {/* ABA ANÚNCIOS */}
                <TabsContent value="anuncios">
                  <div className="space-y-2.5 max-h-[360px] overflow-y-auto custom-scrollbar">
                    {selectedCampaign.ads?.length === 0 ? (
                      <div className="text-slate-500 text-xs py-8 text-center">Nenhum anúncio listado nesta campanha</div>
                    ) : (
                      selectedCampaign.ads?.map((ad) => (
                        <div
                          key={ad.id}
                          className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            {ad.creative?.thumbnail_url ? (
                              <img
                                src={ad.creative.thumbnail_url}
                                alt={ad.name}
                                loading="lazy"
                                referrerPolicy="no-referrer"
                                className="w-10 h-10 rounded-lg object-cover bg-slate-950 flex-shrink-0 border border-white/5"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center text-slate-500 text-[10px] flex-shrink-0 border border-white/5">
                                Sem img
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="text-sm font-bold text-white truncate">{ad.name}</div>
                              <div className="text-xs text-slate-400 truncate mt-0.5">
                                {ad.creative?.title || "Anúncio configurado"}
                              </div>
                            </div>
                          </div>

                          <div>
                            {ad.status === "ACTIVE" ? (
                              <Badge variant="roi" pulseDot>
                                Ativo
                              </Badge>
                            ) : (
                              <Badge variant="secondary">
                                Pausado
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>

            </div>
          )}
        </Card>

      </div>

    </div>
  );
}
