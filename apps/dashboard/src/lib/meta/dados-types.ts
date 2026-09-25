// Formato da resposta de /api/meta/contas e /api/meta/dados, usado pelas telas.

import type { Aprendizado, TipoResultado } from "./regras";

export type { TipoResultado };

export type MetaAccount = {
  id: string;
  name: string;
  currency: string;
  isActive: boolean;
  clientId: string | null;
};

export type ClientRef = { id: string; name: string };

export type ContasResponse = {
  contas?: MetaAccount[];
  clientes?: ClientRef[];
  error?: string;
};

export type DailyPoint = {
  date?: string;
  label: string;
  spend: number;
  results: number;
  cpr: number;
  ctr: number;
  impressions: number;
  linkClicks: number;
};

export type AdsetDetail = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  daily_budget: number | null;
  lifetime_budget: number | null;
  learning_stage: string;
  optimization_goal: string;
  /** O que este conjunto otimiza, traduzido: compra, lead, conversa ou nada disso. */
  resultType: TipoResultado | null;
};

export type AdDetail = {
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

export type CampaignSituation = "ATIVA" | "PAUSADA" | "SEM_ENTREGA";

export type MetaCampaign = {
  id: string;
  name: string;
  objective: string;
  status: string;
  effective_status: string;
  situacao: CampaignSituation;
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
  /** Orçamento como está na entidade (diário ou total, na campanha ou somado dos conjuntos ligados). */
  budget: { valor: number; periodo: "dia" | "total"; onde: "campanha" | "conjuntos" } | null;
  /** Resultado que combina com o que a campanha otimiza. null = alcance/tráfego, sem compra/lead/conversa. */
  resultType: TipoResultado | null;
  /** Nome do resultado no plural ("compras", "conversas"...). */
  resultLabel: string;
  learning: Aprendizado;
  frequency: number;
  activeAdsets: number;
  serieDiaria: DailyPoint[];
  adsets: AdsetDetail[];
  ads: AdDetail[];
};

export type MetaCreative = {
  id: string;
  name: string;
  campaign_id: string;
  campaign_name: string;
  spend: number;
  results: number;
  cpr: number;
  ctr: number;
  impressions: number;
  cpm: number;
  resultLabel: string;
  isVideo: boolean;
  video3s: number;
  videoP100: number;
  /** % das impressões que assistiram 3 segundos. */
  hookRate: number;
  /** % das impressões que assistiram o vídeo até o fim (mesma base do hookRate). */
  retentionRate: number;
  /** CTR caiu mais de 20% E CPM subiu mais de 10% contra o período anterior. */
  cansado: boolean;
  thumbnail: string | null;
  title: string;
  body: string;
};

export type FunnelStep = {
  nome: string;
  valor: number;
  pctAnterior: number;
  pctTopo: number;
  /** Taxa de passagem da mesma etapa no período anterior (null quando não havia base). */
  pctPeriodoAnterior: number | null;
};

export type HeatmapCell = {
  spend: number;
  clicks: number;
  /** Resultados do tipo principal da conta (o nome ficou por compatibilidade). */
  leads: number;
  count: number;
};

export type Aviso = {
  tipo: "alerta" | "atencao" | "sucesso" | "info";
  titulo: string;
  descricao: string;
  acao: string;
};

export type Totais = {
  spend: number;
  results: number;
  primaryType: string;
  resultType: TipoResultado | null;
  /** Gasto só das campanhas do tipo principal: é a base do custo por resultado. */
  spendResultType: number;
  reach: number;
  frequency: number;
  /** Outros tipos de resultado presentes (ex.: conversas numa conta de compra). */
  outros: { tipo: TipoResultado; label: string; results: number; spend: number }[];
  cpr: number;
  roas: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpm: number;
  purchases: number;
  leads: number;
  messages: number;
  revenue: number;
};

/** Variação % contra o período anterior. null = o anterior era zero, não existe comparação. */
export type Variacoes = {
  spend: number | null;
  results: number | null;
  cpr: number | null;
  roas: number | null;
  ctr: number | null;
  cpm: number | null;
  impressions: number | null;
  clicks: number | null;
};

export type DadosResponse = {
  conta: { id: string; name: string; currency: string; timezone: string };
  totais: Totais;
  variacoes: Variacoes;
  serieDiaria: DailyPoint[];
  periodo: { range: string; atual: { since: string; until: string }; anterior: { since: string; until: string } };
  funil: { base: string; etapas: FunnelStep[]; gargalo: { etapa: string; explicacao: string } };
  campanhas: MetaCampaign[];
  criativos: MetaCreative[];
  /** 7 dias da semana (0 = domingo) × 24 horas. */
  heatmap: HeatmapCell[][];
  avisos: Aviso[];
  timestamp: string;
  cached?: boolean;
  cacheAgeSeconds?: number;
  /** A Meta devolveu erro de limite (17): estes dados vêm do cache e `warning` explica. */
  rateLimited?: boolean;
  warning?: string;
};
