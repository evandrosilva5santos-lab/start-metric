import type { VariableChannel } from "./types";

export type ReportObjective = "RECONHECIMENTO" | "TRAFEGO" | "ENGAJAMENTO" | "CADASTRO" | "CONVERSAO" | "APP_INSTALL";

export interface ReportPreset {
  id: string;
  name: string;
  objective: ReportObjective;
  channel: VariableChannel;
  description: string;
  content: string;
}

export type AlertCondition =
  | "balance_below"
  | "api_error"
  | "cpa_above"
  | "ctr_below"
  | "roas_below"
  | "spend_no_conversion";

export interface AlertPreset {
  id: string;
  name: string;
  conditionType: AlertCondition;
  description: string;
  defaultThreshold?: number;
  content: string;
}

export interface LeadPreset {
  id: string;
  name: string;
  description: string;
  content: string;
}

export const REPORT_PRESETS: readonly ReportPreset[] = [
  {
    id: "reconhecimento-meta",
    name: "Reconhecimento — Meta Ads",
    objective: "RECONHECIMENTO",
    channel: "meta",
    description: "Foco em Alcance, Impressões, CPM e Valor Investido.",
    content: `Olá! Segue abaixo relatório das campanhas de Reconhecimento:

Período: {{start_date}} a {{end_date}}

Alcance: {{meta_reach}}
Impressões: {{meta_impressions}}
Custo por mil impressões: {{meta_cpm}}
Valor investido: {{meta_spend}}`,
  },
  {
    id: "reconhecimento-google",
    name: "Reconhecimento — Google Ads",
    objective: "RECONHECIMENTO",
    channel: "google",
    description: "Foco em Impressões, CPM, Parcela de impressões de pesquisa e Valor Investido.",
    content: `Olá! Segue abaixo o relatório das campanhas de Reconhecimento (Google Ads):

Período: {{start_date}} a {{end_date}}

Impressões: {{google_impressions}}
CPM: {{google_cpm}}
Parcela de impressões (Search): {{google_search_impression_share}}
Valor investido: {{google_spend}}`,
  },
  {
    id: "trafego-meta",
    name: "Tráfego — Meta Ads",
    objective: "TRAFEGO",
    channel: "meta",
    description: "Foco em Alcance, Cliques, CTR, CPC e Investimento.",
    content: `Olá! Segue abaixo relatório das campanhas de Tráfego:

Período: {{start_date}} a {{end_date}}

Alcance: {{meta_reach}}
Impressões: {{meta_impressions}}
Custo impressões (CPM): {{meta_cpm}}
Cliques: {{meta_clicks}}
CPC: {{meta_cpc}}
Valor investido: {{meta_spend}}`,
  },
  {
    id: "trafego-google",
    name: "Tráfego — Google Ads",
    objective: "TRAFEGO",
    channel: "google",
    description: "Foco em Cliques no Link, CTR, CPC e Investimento.",
    content: `Olá! Segue abaixo o relatório das campanhas de Tráfego (Google Ads):

Período: {{start_date}} a {{end_date}}

Impressões: {{google_impressions}}
Cliques: {{google_clicks}}
CTR: {{google_ctr}}
CPC: {{google_cpc}}
Valor investido: {{google_spend}}`,
  },
  {
    id: "engajamento-meta",
    name: "Engajamento — Meta Ads",
    objective: "ENGAJAMENTO",
    channel: "meta",
    description: "Foco em Alcance, Cliques, Engajamento no Post e Investimento.",
    content: `Olá! Segue abaixo relatório das campanhas de Engajamento:

Período: {{start_date}} a {{end_date}}

Impressões: {{meta_impressions}}
Alcance: {{meta_reach}}
Taxa de cliques (CTR): {{meta_ctr}}
Engajamento no post: {{meta_inline_post_engagement}}
Valor investido: {{meta_spend}}`,
  },
  {
    id: "engajamento-google",
    name: "Engajamento — Google Ads",
    objective: "ENGAJAMENTO",
    channel: "google",
    description: "Foco em Visualizações e Engajamento da Rede Display/YouTube.",
    content: `Olá! Segue abaixo o relatório das campanhas de Engajamento (Google Ads):

Período: {{start_date}} a {{end_date}}

Impressões: {{google_impressions}}
Cliques: {{google_clicks}}
CTR: {{google_ctr}}
Valor investido: {{google_spend}}`,
  },
  {
    id: "cadastro-meta",
    name: "Cadastro / Leads — Meta Ads",
    objective: "CADASTRO",
    channel: "meta",
    description: "Foco em Leads gerados no formulário ou pixel e Custo por Lead.",
    content: `Olá! Segue abaixo relatório das campanhas de Cadastro / Leads:

Período: {{start_date}} a {{end_date}}

Impressões: {{meta_impressions}}
Alcance: {{meta_reach}}
Taxa de cliques (CTR): {{meta_ctr}}
Cadastros / Leads: {{meta_actions.lead}}
Custo por Lead: {{meta_cost_per_action.lead}}
Valor investido: {{meta_spend}}`,
  },
  {
    id: "cadastro-google",
    name: "Cadastro / Leads — Google Ads",
    objective: "CADASTRO",
    channel: "google",
    description: "Foco em Conversões de Leads e Custo por Conversão.",
    content: `Olá! Segue abaixo o relatório das campanhas de Cadastro (Google Ads):

Período: {{start_date}} a {{end_date}}

Impressões: {{google_impressions}}
Cliques: {{google_clicks}}
Conversões: {{google_conversions}}
Custo por conversão: {{google_cost_per_conversion}}
Valor investido: {{google_spend}}`,
  },
  {
    id: "conversao-meta",
    name: "Conversão & Vendas — Meta Ads",
    objective: "CONVERSAO",
    channel: "meta",
    description: "Foco em Compras no site, ROAS, Valor de Conversão e Custo por Compra.",
    content: `Olá! Segue abaixo relatório das campanhas de Vendas:

Período: {{start_date}} a {{end_date}}

Alcance: {{meta_reach}}
Impressões: {{meta_impressions}}
Custo impressões (CPM): {{meta_cpm}}
Cliques: {{meta_clicks}}
Compras: {{meta_actions.purchase}}
Custo por compra (CPA): {{meta_cost_per_action.purchase}}
Faturamento gerado: {{meta_action_values.purchase}}
ROAS: {{meta_roas}}
Valor investido: {{meta_spend}}`,
  },
  {
    id: "conversao-google",
    name: "Conversão & Vendas — Google Ads",
    objective: "CONVERSAO",
    channel: "google",
    description: "Foco em Vendas e Receita gerada no Google Ads.",
    content: `Olá! Segue abaixo o relatório das campanhas de Vendas (Google Ads):

Período: {{start_date}} a {{end_date}}

Impressões: {{google_impressions}}
Cliques: {{google_clicks}}
Conversões: {{google_conversions}}
Custo por conversão: {{google_cost_per_conversion}}
Valor de conversão: {{google_conversion_value}}
ROAS: {{google_roas}}
Valor investido: {{google_spend}}`,
  },
  {
    id: "app-meta",
    name: "Instalação de App — Meta Ads",
    objective: "APP_INSTALL",
    channel: "meta",
    description: "Foco em Instalações do Aplicativo e Custo por Instalação.",
    content: `Olá! Segue abaixo relatório das campanhas de Instalação de App:

Período: {{start_date}} a {{end_date}}

Impressões: {{meta_impressions}}
Alcance: {{meta_reach}}
Instalações: {{meta_actions.app_install}}
Custo por instalação: {{meta_cost_per_action.app_install}}
Valor investido: {{meta_spend}}`,
  },
  {
    id: "app-google",
    name: "Instalação de App — Google Ads",
    objective: "APP_INSTALL",
    channel: "google",
    description: "Campanhas UAC (Universal App Campaigns) do Google Ads.",
    content: `Olá! Segue abaixo o relatório das campanhas de Instalação de App (Google Ads):

Período: {{start_date}} a {{end_date}}

Impressões: {{google_impressions}}
Cliques: {{google_clicks}}
Instalações: {{google_app_installs}}
Custo por instalação: {{google_cost_per_app_install}}
Valor investido: {{google_spend}}`,
  },
];

// current_value e target_value chegam formatados pelo motor de alertas (R$, % ou número)
export const ALERT_PRESETS: readonly AlertPreset[] = [
  {
    id: "alert-saldo-baixo",
    name: "Saldo Baixo / Crítico",
    conditionType: "balance_below",
    defaultThreshold: 100,
    description: "Dispara quando o saldo da conta pré-paga estiver abaixo do limite.",
    content: `🚨 *Atenção: saldo baixo*

A conta *{{account_name}}* está com saldo de {{current_value}}.
Limite configurado: {{target_value}}.

Recarregue para não interromper as campanhas ativas.`,
  },
  {
    id: "alert-conta-erro",
    name: "Conta com Erro / Bloqueada",
    conditionType: "api_error",
    description: "Dispara quando a Meta sinalizar anúncio rejeitado ou conta desativada.",
    content: `⚠️ *Problema detectado nas campanhas*

A conta *{{account_name}}* apresentou um erro que pode impedir a entrega dos anúncios.
Status da conta: {{account_status}}

Nossa equipe técnica já está analisando o ocorrido.`,
  },
  {
    id: "alert-cpa-alto",
    name: "CPA Acima do Esperado",
    conditionType: "cpa_above",
    defaultThreshold: 45,
    description: "Dispara quando o custo por resultado ultrapassar a meta máxima do cliente.",
    content: `📊 *Alerta de performance: CPA elevado*

Na conta *{{account_name}}*, o custo por resultado atingiu {{current_value}}, acima do teto de {{target_value}}.
Período analisado: {{start_date}} a {{end_date}}

Recomenda-se pausar criativos saturados e revisar segmentação.`,
  },
  {
    id: "alert-ctr-baixo",
    name: "Queda Brusca de CTR",
    conditionType: "ctr_below",
    defaultThreshold: 0.8,
    description: "Dispara quando a taxa de cliques cair, indicando fadiga de criativo.",
    content: `📉 *Alerta: queda na taxa de cliques (CTR)*

A conta *{{account_name}}* registrou taxa de cliques de {{current_value}} (abaixo de {{target_value}}).
Investimento no período: {{meta_spend}}

Sugerimos testar novos ganchos e formatos de criativo.`,
  },
  {
    id: "alert-roas-baixo",
    name: "ROAS Abaixo da Meta",
    conditionType: "roas_below",
    defaultThreshold: 2,
    description: "Dispara quando o retorno sobre o investimento ficar abaixo da meta.",
    content: `📉 *Alerta: ROAS abaixo da meta*

Na conta *{{account_name}}*, o ROAS ficou em {{current_value}}, abaixo da meta de {{target_value}}.
Período analisado: {{start_date}} a {{end_date}}

Vale revisar ofertas e públicos antes de escalar.`,
  },
  {
    id: "alert-gasto-sem-conversao",
    name: "Gasto sem Conversão",
    conditionType: "spend_no_conversion",
    defaultThreshold: 50,
    description: "Dispara quando a conta gasta acima do limite sem registrar conversões.",
    content: `💸 *Gasto sem conversão*

A conta *{{account_name}}* investiu {{current_value}} sem registrar conversões (limite: {{target_value}}).

Confira pixel, página de destino e segmentação.`,
  },
];

export const LEAD_PRESETS: readonly LeadPreset[] = [
  {
    id: "lead-completo",
    name: "Notificação Completa com Origem e Campanha",
    description: "Para equipes de vendas ágeis, com dados de contato e origem do lead.",
    content: `🔔 *Novo lead recebido!*

*Nome:* {{lead_name}}
*Telefone:* {{lead_phone}}
*E-mail:* {{lead_email}}

*Origem:* {{lead_source}}
*Campanha:* {{meta_campaign_name}}
*Recebido em:* {{lead_received_at}}

_Entre em contato em até 5 minutos para maximizar a conversão!_`,
  },
  {
    id: "lead-compacto",
    name: "Notificação Direta (Apenas Contato)",
    description: "Mensagem curta, focada no contato rápido.",
    content: `⚡ *Lead quente na área!*
*Cliente:* {{lead_name}}
*Telefone:* {{lead_phone}}
*Interesse:* {{lead_product}}`,
  },
];
