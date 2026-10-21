import type { VariableDefinition } from "./types";

// Rótulos em português para os action_type da Marketing API
export const ACTION_TYPE_TRANSLATIONS: Record<string, string> = {
  purchase: "Compras",
  fb_pixel_purchase: "Compras no Pixel",
  lead: "Cadastros",
  fb_pixel_lead: "Cadastros no Pixel",
  complete_registration: "Registros Completos",
  fb_pixel_complete_registration: "Registros Completos no Pixel",
  add_to_cart: "Adições ao Carrinho",
  fb_pixel_add_to_cart: "Adições ao Carrinho no Pixel",
  initiate_checkout: "Checkouts Iniciados",
  fb_pixel_initiate_checkout: "Checkouts Iniciados no Pixel",
  add_to_wishlist: "Adições à Lista de Desejos",
  search: "Buscas no Site",
  fb_pixel_search: "Buscas no Pixel",
  view_content: "Visualizações de Conteúdo",
  fb_pixel_view_content: "Visualizações de Conteúdo no Pixel",
  contact: "Contatos",
  customize_product: "Produtos Customizados",
  donate: "Doações",
  find_location: "Localizações Encontradas",
  schedule: "Agendamentos",
  start_trial: "Testes Iniciados",
  submit_application: "Candidaturas Enviadas",
  subscribe: "Assinaturas",
  app_install: "Instalações de Aplicativo",
  post_engagement: "Engajamentos com a Publicação",
  post_reaction: "Reações ao Post",
  page_engagement: "Engajamento com a Página",
  messaging_first_reply: "Primeiras Respostas de Mensagem",
  onsite_conversion_messaging_first_reply: "Mensagens Iniciadas no WhatsApp/Direct",
  onsite_web_lead: "Leads Nativos",
  click_to_call: "Cliques para Ligar",
  landing_page_view: "Visualizações de Página de Destino",
};

export const UNIVERSAL_VARIABLES: VariableDefinition[] = [
  { slug: "client_name", label: "Nome do Cliente", category: "universal", scope: "universal", returns: "text", aggregatable: false, exampleValue: "ACME Corp" },
  { slug: "start_date", label: "Início do Período", category: "universal", scope: "universal", returns: "text", aggregatable: false, exampleValue: "20/09/2026" },
  { slug: "end_date", label: "Fim do Período", category: "universal", scope: "universal", returns: "text", aggregatable: false, exampleValue: "26/09/2026" },
  { slug: "greeting", label: "Saudação Dinâmica", category: "universal", scope: "universal", returns: "text", aggregatable: false, description: "Bom dia / Boa tarde / Boa noite conforme o horário local", exampleValue: "Bom dia" },
  { slug: "client_dashboard_url", label: "Link do Dashboard", category: "universal", scope: "universal", returns: "text", aggregatable: false, exampleValue: "https://app.exemplo.com/shared/dashboard/abc123" },
  { slug: "current_day", label: "Dia Atual", category: "universal", scope: "universal", returns: "text", aggregatable: false, exampleValue: "26" },
  { slug: "current_month", label: "Mês Atual", category: "universal", scope: "universal", returns: "text", aggregatable: false, exampleValue: "Setembro" },
  { slug: "current_year", label: "Ano Atual", category: "universal", scope: "universal", returns: "text", aggregatable: false, exampleValue: "2026" },
  { slug: "current_hour", label: "Hora Atual", category: "universal", scope: "universal", returns: "text", aggregatable: false, exampleValue: "09:00" },
  { slug: "yesterday", label: "Dia de Ontem", category: "universal", scope: "universal", returns: "text", aggregatable: false, exampleValue: "25/09/2026" },
  { slug: "previous_month", label: "Mês Anterior", category: "universal", scope: "universal", returns: "text", aggregatable: false, exampleValue: "Agosto" },
];

export const CALCULATED_VARIABLES: VariableDefinition[] = [
  { slug: "cpc", label: "CPC Calculado", category: "calculated", scope: "calculated", returns: "currency", aggregatable: true, exampleValue: "R$ 0,48" },
  { slug: "cpm", label: "CPM Calculado", category: "calculated", scope: "calculated", returns: "currency", aggregatable: true, exampleValue: "R$ 18,20" },
  { slug: "ctr", label: "Taxa de Cliques (CTR)", category: "calculated", scope: "calculated", returns: "percent", aggregatable: true, exampleValue: "1,85%" },
  { slug: "ctr_all", label: "CTR Todos os Cliques", category: "calculated", scope: "calculated", returns: "percent", aggregatable: true, exampleValue: "2,40%" },
  { slug: "avg_cpc", label: "CPC Médio Consolidado", category: "calculated", scope: "calculated", returns: "currency", aggregatable: true, exampleValue: "R$ 0,52" },
  { slug: "avg_cpm", label: "CPM Médio Consolidado", category: "calculated", scope: "calculated", returns: "currency", aggregatable: true, exampleValue: "R$ 19,40" },
  { slug: "cpc_30d", label: "CPC Médio (30 dias)", category: "calculated", scope: "calculated", returns: "currency", aggregatable: true, exampleValue: "R$ 0,46" },
  { slug: "connect_rate", label: "Connect Rate", category: "calculated", scope: "calculated", returns: "percent", aggregatable: true, description: "Taxa de conexões / cliques no link", exampleValue: "78,4%" },
  { slug: "lead_conversion_rate", label: "Taxa de Conversão de Lead", category: "calculated", scope: "calculated", returns: "percent", aggregatable: true, exampleValue: "12,8%" },
  { slug: "conversion_rate", label: "Taxa de Conversão Geral", category: "calculated", scope: "calculated", returns: "percent", aggregatable: true, exampleValue: "3,15%" },
];

export const META_CORE_METRICS: VariableDefinition[] = [
  { slug: "meta_reach", label: "Alcance", category: "metrics", scope: "channel", channel: "meta", returns: "number", aggregatable: true, exampleValue: "42.850" },
  { slug: "meta_impressions", label: "Impressões", category: "metrics", scope: "channel", channel: "meta", returns: "number", aggregatable: true, exampleValue: "89.200" },
  { slug: "meta_spend", label: "Valor Investido", category: "metrics", scope: "channel", channel: "meta", returns: "currency", aggregatable: true, exampleValue: "R$ 1.624,30" },
  { slug: "meta_cpc", label: "CPC Nativo", category: "metrics", scope: "channel", channel: "meta", returns: "currency", aggregatable: true, exampleValue: "R$ 0,48" },
  { slug: "meta_cpm", label: "Custo por Mil Impressões (CPM)", category: "metrics", scope: "channel", channel: "meta", returns: "currency", aggregatable: true, exampleValue: "R$ 18,20" },
  { slug: "meta_ctr", label: "CTR Nativo", category: "metrics", scope: "channel", channel: "meta", returns: "percent", aggregatable: true, exampleValue: "1,85%" },
  { slug: "meta_clicks", label: "Cliques no Link", category: "metrics", scope: "channel", channel: "meta", returns: "number", aggregatable: true, exampleValue: "3.380" },
  { slug: "meta_frequency", label: "Frequência", category: "metrics", scope: "channel", channel: "meta", returns: "number", aggregatable: false, exampleValue: "2,08" },
  { slug: "meta_inline_link_clicks", label: "Cliques no Link (Inline)", category: "metrics", scope: "channel", channel: "meta", returns: "number", aggregatable: true, exampleValue: "3.120" },
  { slug: "meta_outbound_clicks", label: "Cliques de Saída", category: "metrics", scope: "channel", channel: "meta", returns: "number", aggregatable: true, exampleValue: "2.980" },
  { slug: "meta_inline_post_engagement", label: "Engajamento no Post", category: "metrics", scope: "channel", channel: "meta", returns: "number", aggregatable: true, exampleValue: "5.420" },
  { slug: "meta_estimated_ad_recallers", label: "Lembrança Estimada do Anúncio", category: "metrics", scope: "channel", channel: "meta", returns: "number", aggregatable: true, exampleValue: "4.150" },
  { slug: "meta_account_balance", label: "Saldo da Conta de Anúncios", category: "metrics", scope: "channel", channel: "meta", returns: "currency", aggregatable: false, exampleValue: "R$ 480,00" },
  { slug: "meta_roas", label: "ROAS (Retorno do Gasto)", category: "metrics", scope: "channel", channel: "meta", returns: "number", aggregatable: false, exampleValue: "4,82" },
];

export const META_METADATA_AND_RANKINGS: VariableDefinition[] = [
  { slug: "meta_account_name", label: "Nome da Conta", category: "identification", scope: "channel", channel: "meta", returns: "text", aggregatable: false, exampleValue: "BM Start - Principal" },
  { slug: "meta_campaign_name", label: "Nome da Campanha", category: "identification", scope: "channel", channel: "meta", returns: "text", aggregatable: false, exampleValue: "Vendas - Black Friday" },
  { slug: "meta_adset_name", label: "Nome do Conjunto", category: "identification", scope: "channel", channel: "meta", returns: "text", aggregatable: false, exampleValue: "Público Quente - Remarketing" },
  { slug: "meta_ad_name", label: "Nome do Anúncio", category: "identification", scope: "channel", channel: "meta", returns: "text", aggregatable: false, exampleValue: "Vídeo 01 - Prova Social" },
  { slug: "meta_currency", label: "Moeda da Conta", category: "metadata", scope: "channel", channel: "meta", returns: "text", aggregatable: false, exampleValue: "BRL" },
  { slug: "meta_all_creatives_ranking", label: "Ranking Completo de Criativos", category: "metadata", scope: "channel", channel: "meta", returns: "block", aggregatable: false, description: "Posição, nome, resultado e CPA dos criativos (até 10)" },
  { slug: "meta_top_1_creatives_ranking", label: "Top 1 Melhor Criativo", category: "metadata", scope: "channel", channel: "meta", returns: "block", aggregatable: false },
  { slug: "meta_top_3_creatives_ranking", label: "Top 3 Melhores Criativos", category: "metadata", scope: "channel", channel: "meta", returns: "block", aggregatable: false },
  { slug: "meta_top_5_creatives_ranking", label: "Top 5 Melhores Criativos", category: "metadata", scope: "channel", channel: "meta", returns: "block", aggregatable: false },
  { slug: "meta_instagram_permalink_url", label: "Link do Criativo no Instagram", category: "identification", scope: "channel", channel: "meta", returns: "text", aggregatable: false, exampleValue: "https://instagram.com/p/C0xyz..." },
];

export const META_VIDEO_METRICS: VariableDefinition[] = [
  { slug: "meta_video_play.video_view", label: "Reproduções de Vídeo", category: "video", scope: "channel", channel: "meta", returns: "number", aggregatable: true, exampleValue: "18.400" },
  { slug: "meta_video_thruplay.video_view", label: "ThruPlays (Vídeo 15s+)", category: "video", scope: "channel", channel: "meta", returns: "number", aggregatable: true, exampleValue: "9.250" },
  { slug: "meta_video_avg_time.video_view", label: "Tempo Médio de Reprodução", category: "video", scope: "channel", channel: "meta", returns: "text", aggregatable: false, exampleValue: "8.4 seg" },
  { slug: "meta_video_p25.video_view", label: "Visualização 25%", category: "video", scope: "channel", channel: "meta", returns: "number", aggregatable: true, exampleValue: "14.200" },
  { slug: "meta_video_p50.video_view", label: "Visualização 50%", category: "video", scope: "channel", channel: "meta", returns: "number", aggregatable: true, exampleValue: "8.100" },
  { slug: "meta_video_p75.video_view", label: "Visualização 75%", category: "video", scope: "channel", channel: "meta", returns: "number", aggregatable: true, exampleValue: "4.890" },
  { slug: "meta_video_p95.video_view", label: "Visualização 95%", category: "video", scope: "channel", channel: "meta", returns: "number", aggregatable: true, exampleValue: "2.840" },
  { slug: "meta_video_p100.video_view", label: "Visualização 100%", category: "video", scope: "channel", channel: "meta", returns: "number", aggregatable: true, exampleValue: "2.120" },
];

export const GOOGLE_ADS_METRICS: VariableDefinition[] = [
  { slug: "google_impressions", label: "Impressões (Google)", category: "metrics", scope: "channel", channel: "google", returns: "number", aggregatable: true, exampleValue: "54.200" },
  { slug: "google_clicks", label: "Cliques (Google)", category: "metrics", scope: "channel", channel: "google", returns: "number", aggregatable: true, exampleValue: "2.810" },
  { slug: "google_ctr", label: "CTR (Google)", category: "metrics", scope: "channel", channel: "google", returns: "percent", aggregatable: true, exampleValue: "5,18%" },
  { slug: "google_cpc", label: "CPC Médio (Google)", category: "metrics", scope: "channel", channel: "google", returns: "currency", aggregatable: true, exampleValue: "R$ 1,12" },
  { slug: "google_cpm", label: "CPM (Google)", category: "metrics", scope: "channel", channel: "google", returns: "currency", aggregatable: true, exampleValue: "R$ 58,00" },
  { slug: "google_spend", label: "Valor Investido (Google)", category: "metrics", scope: "channel", channel: "google", returns: "currency", aggregatable: true, exampleValue: "R$ 3.147,20" },
  { slug: "google_search_impression_share", label: "Parcela de Impressões na Rede de Pesquisa", category: "metrics", scope: "channel", channel: "google", returns: "percent", aggregatable: false, exampleValue: "74,2%" },
  { slug: "google_conversions", label: "Conversões (Google)", category: "conversions", scope: "channel", channel: "google", returns: "number", aggregatable: true, exampleValue: "184" },
  { slug: "google_cost_per_conversion", label: "Custo por Conversão (Google)", category: "costs", scope: "channel", channel: "google", returns: "currency", aggregatable: true, exampleValue: "R$ 17,10" },
  { slug: "google_conversion_value", label: "Valor Total de Conversão (Google)", category: "conversions", scope: "channel", channel: "google", returns: "currency", aggregatable: true, exampleValue: "R$ 14.890,00" },
  { slug: "google_roas", label: "ROAS (Google)", category: "metrics", scope: "channel", channel: "google", returns: "number", aggregatable: false, exampleValue: "4,73" },
  { slug: "google_app_installs", label: "Instalações de App (Google)", category: "conversions", scope: "channel", channel: "google", returns: "number", aggregatable: true, exampleValue: "420" },
  { slug: "google_cost_per_app_install", label: "Custo por Instalação (Google)", category: "costs", scope: "channel", channel: "google", returns: "currency", aggregatable: true, exampleValue: "R$ 7,50" },
];

// Valores de alerta chegam já formatados pelo motor de alertas (moeda, % ou número conforme a condição)
export const ALERT_VARIABLES: VariableDefinition[] = [
  { slug: "account_name", label: "Nome da Conta no Alerta", category: "alert", scope: "alert", returns: "text", aggregatable: false, exampleValue: "BM Start - Captação" },
  { slug: "account_type", label: "Tipo de Conta (Pré/Pós-paga)", category: "alert", scope: "alert", returns: "text", aggregatable: false, exampleValue: "Pré-paga" },
  { slug: "account_status", label: "Status da Conta", category: "alert", scope: "alert", returns: "text", aggregatable: false, exampleValue: "Ativa" },
  { slug: "alert_type", label: "Tipo de Alerta", category: "alert", scope: "alert", returns: "text", aggregatable: false, exampleValue: "Saldo Crítico" },
  { slug: "current_value", label: "Valor Atual da Métrica", category: "alert", scope: "alert", returns: "text", aggregatable: false, exampleValue: "R$ 52,40" },
  { slug: "target_value", label: "Valor Limite Configurado", category: "alert", scope: "alert", returns: "text", aggregatable: false, exampleValue: "R$ 100,00" },
];

export const LEAD_VARIABLES: VariableDefinition[] = [
  { slug: "lead_name", label: "Nome do Lead", category: "lead", scope: "lead", returns: "text", aggregatable: false, exampleValue: "Maria Souza" },
  { slug: "lead_phone", label: "Telefone do Lead", category: "lead", scope: "lead", returns: "text", aggregatable: false, exampleValue: "+55 11 99999-8888" },
  { slug: "lead_email", label: "E-mail do Lead", category: "lead", scope: "lead", returns: "text", aggregatable: false, exampleValue: "maria@exemplo.com" },
  { slug: "lead_source", label: "Origem do Lead", category: "lead", scope: "lead", returns: "text", aggregatable: false, exampleValue: "Formulário do site" },
  { slug: "lead_product", label: "Interesse do Lead", category: "lead", scope: "lead", returns: "text", aggregatable: false, exampleValue: "Plano Anual" },
  { slug: "lead_received_at", label: "Data e Hora do Lead", category: "lead", scope: "lead", returns: "text", aggregatable: false, exampleValue: "16/10/2026 09:14" },
];

function buildActionTypeVariables(): VariableDefinition[] {
  const counts: VariableDefinition[] = [];
  const values: VariableDefinition[] = [];
  const costs: VariableDefinition[] = [];

  for (const [actionType, label] of Object.entries(ACTION_TYPE_TRANSLATIONS)) {
    counts.push({ slug: `meta_actions.${actionType}`, label: `${label} (Total)`, category: "conversions", scope: "channel", channel: "meta", returns: "number", aggregatable: true, exampleValue: "142" });
    values.push({ slug: `meta_action_values.${actionType}`, label: `Valor de ${label}`, category: "conversions", scope: "channel", channel: "meta", returns: "currency", aggregatable: true, exampleValue: "R$ 7.820,00" });
    costs.push({ slug: `meta_cost_per_action.${actionType}`, label: `Custo por ${label} (CPA)`, category: "costs", scope: "channel", channel: "meta", returns: "currency", aggregatable: true, exampleValue: "R$ 14,20" });
  }

  return [...counts, ...values, ...costs];
}

export const FULL_VARIABLE_CATALOG: readonly VariableDefinition[] = [
  ...UNIVERSAL_VARIABLES,
  ...CALCULATED_VARIABLES,
  ...META_CORE_METRICS,
  ...META_METADATA_AND_RANKINGS,
  ...META_VIDEO_METRICS,
  ...buildActionTypeVariables(),
  ...GOOGLE_ADS_METRICS,
  ...ALERT_VARIABLES,
  ...LEAD_VARIABLES,
];

export const VARIABLE_BY_SLUG: ReadonlyMap<string, VariableDefinition> = new Map(
  FULL_VARIABLE_CATALOG.map((v) => [v.slug, v]),
);
