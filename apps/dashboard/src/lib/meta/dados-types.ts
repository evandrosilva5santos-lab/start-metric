// Formato da resposta de /api/meta/contas e /api/meta/dados, usado pelas telas.

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
  isVideo: boolean;
  video3s: number;
  videoP100: number;
  hookRate: number;
  retentionRate: number;
  thumbnail: string | null;
  title: string;
  body: string;
};

export type FunnelStep = {
  nome: string;
  valor: number;
  pctAnterior: number;
  pctTopo: number;
};

export type HeatmapCell = {
  spend: number;
  clicks: number;
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

export type Variacoes = {
  spend: number;
  results: number;
  cpr: number;
  roas: number;
  ctr: number;
  cpm: number;
  impressions: number;
  clicks: number;
};

export type DadosResponse = {
  conta: { id: string; name: string; currency: string; timezone: string };
  totais: Totais;
  variacoes: Variacoes;
  serieDiaria: DailyPoint[];
  funil: { etapas: FunnelStep[]; gargalo: { etapa: string; explicacao: string } };
  campanhas: MetaCampaign[];
  criativos: MetaCreative[];
  /** 7 dias da semana (0 = domingo) × 24 horas. */
  heatmap: HeatmapCell[][];
  avisos: Aviso[];
  timestamp: string;
  cached?: boolean;
  warning?: string;
};
