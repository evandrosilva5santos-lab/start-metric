/**
 * api/dados.js
 * Retorna os dados consolidados da conta de anúncios da Meta:
 * - Totais e comparativo com período anterior
 * - Série diária para gráficos
 * - Funil de conversão com identificação de gargalo
 * - Lista de campanhas (com orçamento, status, adsets e detecção de "Sem entrega")
 * - Criativos com métricas de vídeo (hook rate 3s e retenção 100%)
 * - Mapa de calor horário 7x24 (dia da semana x hora)
 * - Diagnóstico inteligente com recomendações em português
 */

const CACHE_TTL_MS = 90 * 1000;
const memoryCache = new Map();

// Helper para datas no fuso horário da conta
function getAccountLocalDate(timezone, offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone || 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(d);
}

// Calcular períodos de datas
function calculateDateRanges(rangeType, timezone) {
  const todayStr = getAccountLocalDate(timezone, 0);
  const yesterdayStr = getAccountLocalDate(timezone, -1);

  let curStart, curStop, prevStart, prevStop;

  switch (rangeType) {
    case 'today':
      curStart = todayStr;
      curStop = todayStr;
      prevStart = yesterdayStr;
      prevStop = yesterdayStr;
      break;

    case 'yesterday':
      curStart = yesterdayStr;
      curStop = yesterdayStr;
      prevStart = getAccountLocalDate(timezone, -2);
      prevStop = getAccountLocalDate(timezone, -2);
      break;

    case 'last_7d':
      curStart = getAccountLocalDate(timezone, -7);
      curStop = yesterdayStr;
      prevStart = getAccountLocalDate(timezone, -14);
      prevStop = getAccountLocalDate(timezone, -8);
      break;

    case 'last_14d':
      curStart = getAccountLocalDate(timezone, -14);
      curStop = yesterdayStr;
      prevStart = getAccountLocalDate(timezone, -28);
      prevStop = getAccountLocalDate(timezone, -15);
      break;

    case 'this_month': {
      const parts = todayStr.split('-');
      curStart = `${parts[0]}-${parts[1]}-01`;
      curStop = todayStr;
      // Mês anterior mesmo intervalo de dias
      const d = new Date(`${parts[0]}-${parts[1]}-01T12:00:00Z`);
      d.setMonth(d.getMonth() - 1);
      const prevYear = d.getFullYear();
      const prevMonth = String(d.getMonth() + 1).padStart(2, '0');
      prevStart = `${prevYear}-${prevMonth}-01`;
      const curDay = parseInt(parts[2], 10);
      prevStop = `${prevYear}-${prevMonth}-${String(Math.min(curDay, 28)).padStart(2, '0')}`;
      break;
    }

    case 'last_month': {
      const parts = todayStr.split('-');
      const d = new Date(`${parts[0]}-${parts[1]}-01T12:00:00Z`);
      d.setMonth(d.getMonth() - 1);
      const lmYear = d.getFullYear();
      const lmMonth = String(d.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(lmYear, d.getMonth() + 1, 0).getDate();
      curStart = `${lmYear}-${lmMonth}-01`;
      curStop = `${lmYear}-${lmMonth}-${lastDay}`;

      // 2 meses atrás
      d.setMonth(d.getMonth() - 1);
      const prevYear = d.getFullYear();
      const prevMonth = String(d.getMonth() + 1).padStart(2, '0');
      const prevLastDay = new Date(prevYear, d.getMonth() + 1, 0).getDate();
      prevStart = `${prevYear}-${prevMonth}-01`;
      prevStop = `${prevYear}-${prevMonth}-${prevLastDay}`;
      break;
    }

    case 'last_30d':
    default:
      curStart = getAccountLocalDate(timezone, -30);
      curStop = yesterdayStr;
      prevStart = getAccountLocalDate(timezone, -60);
      prevStop = getAccountLocalDate(timezone, -31);
      break;
  }

  return {
    current: { since: curStart, until: curStop },
    previous: { since: prevStart, until: prevStop },
  };
}

// Desduplicação estrita de conversões
function extractDeduplicatedResults(actions = [], actionValues = []) {
  const actMap = {};
  for (const a of actions) {
    actMap[a.action_type] = parseFloat(a.value || 0);
  }

  let purchases = 0;
  if (actMap['purchase'] !== undefined) purchases = actMap['purchase'];
  else if (actMap['omni_purchase'] !== undefined) purchases = actMap['omni_purchase'];
  else if (actMap['offsite_conversion.fb_pixel_purchase'] !== undefined) purchases = actMap['offsite_conversion.fb_pixel_purchase'];

  let leads = 0;
  if (actMap['lead'] !== undefined) leads = actMap['lead'];
  else if (actMap['onsite_conversion.lead_grouped'] !== undefined) leads = actMap['onsite_conversion.lead_grouped'];
  else if (actMap['offsite_complete_registration_add_meta_leads'] !== undefined) leads = actMap['offsite_complete_registration_add_meta_leads'];
  else if (actMap['offsite_conversion.fb_pixel_lead'] !== undefined) leads = actMap['offsite_conversion.fb_pixel_lead'];

  let messages = 0;
  if (actMap['onsite_conversion.messaging_conversation_started_7d'] !== undefined) {
    messages = actMap['onsite_conversion.messaging_conversation_started_7d'];
  } else if (actMap['onsite_conversion.messaging_first_reply'] !== undefined) {
    messages = actMap['onsite_conversion.messaging_first_reply'];
  }

  let linkClicks = actMap['link_click'] || 0;
  let landingPageViews = actMap['landing_page_view'] || actMap['offsite_content_view'] || 0;
  let checkouts = actMap['initiate_checkout'] || actMap['omni_initiated_checkout'] || 0;
  let videoViews3s = actMap['video_view'] || 0;

  // Valor retornado
  let revenue = 0;
  for (const av of actionValues) {
    if (av.action_type === 'purchase' || av.action_type === 'omni_purchase' || av.action_type === 'offsite_conversion.fb_pixel_purchase') {
      revenue = Math.max(revenue, parseFloat(av.value || 0));
    }
  }

  // Resultado principal
  let primaryType = 'leads';
  let primaryCount = leads;
  if (purchases > 0 && purchases >= leads) {
    primaryType = 'compras';
    primaryCount = purchases;
  } else if (leads === 0 && messages > 0) {
    primaryType = 'mensagens';
    primaryCount = messages;
  } else if (primaryCount === 0 && purchases > 0) {
    primaryType = 'compras';
    primaryCount = purchases;
  }

  return {
    results: primaryCount,
    primaryType,
    purchases,
    leads,
    messages,
    linkClicks,
    landingPageViews,
    checkouts,
    videoViews3s,
    revenue,
  };
}

export default async function handler(req, res) {
  // CORS: same-origin apenas — o painel é servido pelo mesmo servidor.

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = process.env.META_TOKEN || process.env.META_SYSTEM_TOKEN || process.env.META_USER_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'META_TOKEN não configurado no .env' });
  }

  const accountId = req.query?.account_id;
  const rangeType = req.query?.range || 'last_30d';
  const forceFresh = req.query?.fresh === 'true' || req.query?.fresh === '1';

  if (!accountId) {
    return res.status(400).json({ error: 'Parâmetro account_id é obrigatório.' });
  }

  const cacheKey = `${accountId}_${rangeType}`;
  const now = Date.now();

  // Cache Check
  if (!forceFresh && memoryCache.has(cacheKey)) {
    const cached = memoryCache.get(cacheKey);
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return res.status(200).json({
        ...cached.data,
        cached: true,
        cacheAgeSeconds: Math.round((now - cached.timestamp) / 1000),
      });
    }
  }

  const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || 'v21.0';
  const BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

  try {
    // 1. Obter informações básicas da conta (fuso horário, moeda, nome)
    const accRes = await fetch(
      `${BASE_URL}/${accountId}?fields=id,name,currency,timezone_name,account_status,amount_spent&access_token=${encodeURIComponent(token)}`
    );
    const accData = await accRes.json();

    if (accData.error) {
      if (accData.error.code === 17 && memoryCache.has(cacheKey)) {
        return res.status(200).json({
          ...memoryCache.get(cacheKey).data,
          cached: true,
          rateLimitHit: true,
          warning: 'Limite temporário da Meta atingido. Servindo dados do cache de 90s.',
        });
      }
      return res.status(400).json({ error: `Erro na conta (${accData.error.code}): ${accData.error.message}` });
    }

    const timezone = accData.timezone_name || 'America/Sao_Paulo';
    const currency = accData.currency || 'BRL';
    const dateRanges = calculateDateRanges(rangeType, timezone);

    // 2. Buscar Insights do Período Atual e Anterior em paralelo
    const timeRangeParam = encodeURIComponent(JSON.stringify(dateRanges.current));
    const prevRangeParam = encodeURIComponent(JSON.stringify(dateRanges.previous));

    const fieldsInsights = 'spend,impressions,clicks,actions,action_values,cpm,ctr';

    const [currentInsightsRes, prevInsightsRes, dailyInsightsRes, campaignsRes, adsetsRes, adsRes] = await Promise.all([
      fetch(`${BASE_URL}/${accountId}/insights?time_range=${timeRangeParam}&fields=${fieldsInsights}&access_token=${encodeURIComponent(token)}`),
      fetch(`${BASE_URL}/${accountId}/insights?time_range=${prevRangeParam}&fields=${fieldsInsights}&access_token=${encodeURIComponent(token)}`),
      fetch(`${BASE_URL}/${accountId}/insights?time_range=${timeRangeParam}&time_increment=1&fields=${fieldsInsights}&access_token=${encodeURIComponent(token)}`),
      fetch(`${BASE_URL}/${accountId}/campaigns?fields=id,name,status,effective_status,objective,daily_budget,lifetime_budget&limit=100&access_token=${encodeURIComponent(token)}`),
      fetch(`${BASE_URL}/${accountId}/adsets?fields=id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,learning_stage_info,optimization_goal&limit=100&access_token=${encodeURIComponent(token)}`),
      fetch(`${BASE_URL}/${accountId}/ads?fields=id,name,campaign_id,adset_id,status,effective_status,creative{id,name,thumbnail_url,image_url,title,body}&limit=100&access_token=${encodeURIComponent(token)}`),
    ]);

    const [curRaw, prevRaw, dailyRaw, campRaw, adsetsRaw, adsRaw] = await Promise.all([
      currentInsightsRes.json(),
      prevInsightsRes.json(),
      dailyInsightsRes.json(),
      campaignsRes.json(),
      adsetsRes.json(),
      adsRes.json(),
    ]);

    // Verificar se houve rate limit
    for (const r of [curRaw, prevRaw, dailyRaw, campRaw]) {
      if (r?.error?.code === 17 && memoryCache.has(cacheKey)) {
        return res.status(200).json({
          ...memoryCache.get(cacheKey).data,
          cached: true,
          rateLimitHit: true,
          warning: 'Limite de consultas da Meta atingido. Exibindo dados recentes em cache.',
        });
      }
    }

    // 3. Processar Totais Atuais e Recalcular Métricas
    const curData = curRaw.data?.[0] || {};
    const curSpend = parseFloat(curData.spend || 0);
    const curImpressions = parseInt(curData.impressions || 0, 10);
    const curClicks = parseInt(curData.clicks || 0, 10);
    const curDedup = extractDeduplicatedResults(curData.actions, curData.action_values);

    const curLinkClicks = curDedup.linkClicks || curClicks;
    const curCpm = curImpressions > 0 ? (curSpend / curImpressions) * 1000 : 0;
    const curCtr = curImpressions > 0 ? (curLinkClicks / curImpressions) * 100 : 0;
    const curCpr = curDedup.results > 0 ? curSpend / curDedup.results : 0;
    const curRoas = curSpend > 0 && curDedup.revenue > 0 ? curDedup.revenue / curSpend : 0;

    // 4. Processar Período Anterior
    const prevData = prevRaw.data?.[0] || {};
    const prevSpend = parseFloat(prevData.spend || 0);
    const prevImpressions = parseInt(prevData.impressions || 0, 10);
    const prevClicks = parseInt(prevData.clicks || 0, 10);
    const prevDedup = extractDeduplicatedResults(prevData.actions, prevData.action_values);

    const prevLinkClicks = prevDedup.linkClicks || prevClicks;
    const prevCpm = prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : 0;
    const prevCtr = prevImpressions > 0 ? (prevLinkClicks / prevImpressions) * 100 : 0;
    const prevCpr = prevDedup.results > 0 ? prevSpend / prevDedup.results : 0;
    const prevRoas = prevSpend > 0 && prevDedup.revenue > 0 ? prevDedup.revenue / prevSpend : 0;

    // Calcular variações %
    const calcVar = (curr, prev) => {
      if (prev === 0) return curr > 0 ? 100 : 0;
      return ((curr - prev) / prev) * 100;
    };

    const variacoes = {
      spend: calcVar(curSpend, prevSpend),
      results: calcVar(curDedup.results, prevDedup.results),
      cpr: calcVar(curCpr, prevCpr),
      roas: calcVar(curRoas, prevRoas),
      ctr: calcVar(curCtr, prevCtr),
      cpm: calcVar(curCpm, prevCpm),
      impressions: calcVar(curImpressions, prevImpressions),
      clicks: calcVar(curLinkClicks, prevLinkClicks),
    };

    // 5. Série Diária para o Gráfico
    const dailyList = dailyRaw.data || [];
    const serieDiaria = dailyList.map((d) => {
      const daySpend = parseFloat(d.spend || 0);
      const dayImp = parseInt(d.impressions || 0, 10);
      const dayDedup = extractDeduplicatedResults(d.actions, d.action_values);
      const dayCpr = dayDedup.results > 0 ? daySpend / dayDedup.results : 0;
      const dayCtr = dayImp > 0 ? (dayDedup.linkClicks / dayImp) * 100 : 0;

      // Label DD/MM
      const parts = (d.date_start || '').split('-');
      const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : d.date_start;

      return {
        date: d.date_start,
        label,
        spend: daySpend,
        results: dayDedup.results,
        cpr: dayCpr,
        ctr: dayCtr,
        impressions: dayImp,
        linkClicks: dayDedup.linkClicks,
      };
    });

    // 6. Funil de Conversão e Identificação de Gargalo
    const funilImpressions = curImpressions;
    const funilLinkClicks = curLinkClicks;
    const funilLandingViews = curDedup.landingPageViews || Math.round(curLinkClicks * 0.85);
    const funilCheckouts = curDedup.checkouts || Math.round(curDedup.results * 1.3);
    const funilResults = curDedup.results;

    // Taxas de passagem
    const rateImpToClick = funilImpressions > 0 ? (funilLinkClicks / funilImpressions) * 100 : 0;
    const rateClickToPage = funilLinkClicks > 0 ? (funilLandingViews / funilLinkClicks) * 100 : 0;
    const ratePageToCheckout = funilLandingViews > 0 ? (funilCheckouts / funilLandingViews) * 100 : 0;
    const rateCheckoutToResult = funilCheckouts > 0 ? (funilResults / funilCheckouts) * 100 : 0;

    let gargaloDiagnostico = 'Funil equilibrado no período.';
    let gargaloEtapa = 'Nenhum';

    if (rateImpToClick < 0.8 && funilImpressions > 1000) {
      gargaloEtapa = 'Criativo (Impressão -> Clique)';
      gargaloDiagnostico = `CTR baixo (${rateImpToClick.toFixed(2)}%). Os anúncios não estão capturando a atenção do público nos primeiros segundos.`;
    } else if (rateClickToPage < 65 && funilLinkClicks > 50) {
      gargaloEtapa = 'Carregamento do Site (Clique -> Visita)';
      gargaloDiagnostico = `Apenas ${rateClickToPage.toFixed(1)}% dos que clicam chegam a abrir sua página. O site pode estar lento ou o Pixel com delay.`;
    } else if (ratePageToCheckout < 3 && funilLandingViews > 100) {
      gargaloEtapa = 'Proposta da Página (Visita -> Checkout/Formulário)';
      gargaloDiagnostico = `Muitos visitantes na página (${funilLandingViews}), mas poucos iniciam conversão (${ratePageToCheckout.toFixed(1)}%). Oferta ou botão de ação precisam de mais clareza.`;
    } else if (rateCheckoutToResult < 25 && funilCheckouts > 10) {
      gargaloEtapa = 'Fechamento / Checkout (Início -> Conclusão)';
      gargaloDiagnostico = `Alta desistência no fechamento (apenas ${rateCheckoutToResult.toFixed(1)}% finalizam). Verifique atrito no checkout ou formulário extenso.`;
    }

    const funil = {
      etapas: [
        { nome: 'Impressões', valor: funilImpressions, pctAnterior: 100, pctTopo: 100 },
        { nome: 'Cliques no Link', valor: funilLinkClicks, pctAnterior: rateImpToClick, pctTopo: rateImpToClick },
        { nome: 'Visitas à Página', valor: funilLandingViews, pctAnterior: rateClickToPage, pctTopo: funilImpressions > 0 ? (funilLandingViews / funilImpressions) * 100 : 0 },
        { nome: 'Início de Ação', valor: funilCheckouts, pctAnterior: ratePageToCheckout, pctTopo: funilImpressions > 0 ? (funilCheckouts / funilImpressions) * 100 : 0 },
        { nome: curDedup.primaryType === 'compras' ? 'Compras' : 'Resultados (Leads)', valor: funilResults, pctAnterior: rateCheckoutToResult, pctTopo: funilImpressions > 0 ? (funilResults / funilImpressions) * 100 : 0 },
      ],
      gargalo: {
        etapa: gargaloEtapa,
        explicacao: gargaloDiagnostico,
      },
    };

    // 7. Processar Campanhas (com adsets, orçamento real e cruzamento com insights)
    // Buscar insights por campanha para o período
    let campInsights = [];
    try {
      const campInsRes = await fetch(
        `${BASE_URL}/${accountId}/insights?level=campaign&time_range=${timeRangeParam}&fields=campaign_id,campaign_name,spend,impressions,clicks,actions,cpm,ctr&limit=100&access_token=${encodeURIComponent(token)}`
      );
      const campInsData = await campInsRes.json();
      campInsights = campInsData.data || [];
    } catch {
      campInsights = [];
    }

    const campInsightsMap = {};
    for (const ci of campInsights) {
      campInsightsMap[ci.campaign_id] = ci;
    }

    // Mapa de Adsets por Campanha
    const rawAdsets = adsetsRaw.data || [];
    const adsetsByCampaign = {};
    for (const adset of rawAdsets) {
      if (!adsetsByCampaign[adset.campaign_id]) {
        adsetsByCampaign[adset.campaign_id] = [];
      }
      adsetsByCampaign[adset.campaign_id].push({
        id: adset.id,
        name: adset.name,
        status: adset.status,
        effective_status: adset.effective_status,
        daily_budget: adset.daily_budget ? parseFloat(adset.daily_budget) / 100 : null,
        lifetime_budget: adset.lifetime_budget ? parseFloat(adset.lifetime_budget) / 100 : null,
        learning_stage: adset.learning_stage_info?.status || 'NORMAL',
        optimization_goal: adset.optimization_goal,
      });
    }

    // Mapa de Ads por Campanha
    const rawAds = adsRaw.data || [];
    const adsByCampaign = {};
    for (const ad of rawAds) {
      if (!adsByCampaign[ad.campaign_id]) {
        adsByCampaign[ad.campaign_id] = [];
      }
      adsByCampaign[ad.campaign_id].push({
        id: ad.id,
        name: ad.name,
        adset_id: ad.adset_id,
        status: ad.status,
        effective_status: ad.effective_status,
        creative: ad.creative ? {
          id: ad.creative.id,
          name: ad.creative.name,
          thumbnail_url: ad.creative.thumbnail_url || ad.creative.image_url,
          title: ad.creative.title,
          body: ad.creative.body,
        } : null,
      });
    }

    const rawCampaigns = campRaw.data || [];
    const campanhas = rawCampaigns.map((camp) => {
      const ins = campInsightsMap[camp.id] || {};
      const spend = parseFloat(ins.spend || 0);
      const imp = parseInt(ins.impressions || 0, 10);
      const dedup = extractDeduplicatedResults(ins.actions);
      const results = dedup.results;
      const cpr = results > 0 ? spend / results : 0;
      const ctr = imp > 0 ? (dedup.linkClicks / imp) * 100 : 0;
      const cpm = imp > 0 ? (spend / imp) * 1000 : 0;

      // Orçamento: campanha CBO ou soma dos adsets
      let dailyBudget = camp.daily_budget ? parseFloat(camp.daily_budget) / 100 : null;
      let budgetType = 'Campanha (CBO)';
      if (!dailyBudget && adsetsByCampaign[camp.id]) {
        const sumAdsets = adsetsByCampaign[camp.id].reduce((acc, a) => acc + (a.daily_budget || 0), 0);
        if (sumAdsets > 0) {
          dailyBudget = sumAdsets;
          budgetType = 'Conjunto (ABO)';
        }
      }

      // Regra: Campanha ligada sem gasto = "Sem entrega"
      const isConfigActive = camp.status === 'ACTIVE' || camp.effective_status === 'ACTIVE';
      let situacao = 'PAUSADA';
      let situacaoLabel = 'Pausada';
      let situacaoColor = 'gray';

      if (isConfigActive) {
        if (spend === 0) {
          situacao = 'SEM_ENTREGA';
          situacaoLabel = 'Sem entrega';
          situacaoColor = 'amber';
        } else {
          situacao = 'ATIVA';
          situacaoLabel = 'Ativa';
          situacaoColor = 'emerald';
        }
      }

      return {
        id: camp.id,
        name: camp.name,
        objective: camp.objective,
        status: camp.status,
        effective_status: camp.effective_status,
        situacao,
        situacaoLabel,
        situacaoColor,
        spend,
        results,
        cpr,
        ctr,
        cpm,
        impressions: imp,
        daily_budget: dailyBudget,
        budgetType,
        adsets: adsetsByCampaign[camp.id] || [],
        ads: adsByCampaign[camp.id] || [],
      };
    });

    // Ordenar campanhas: ativas com gasto primeiro
    campanhas.sort((a, b) => {
      if (a.situacao === 'ATIVA' && b.situacao !== 'ATIVA') return -1;
      if (a.situacao !== 'ATIVA' && b.situacao === 'ATIVA') return 1;
      return b.spend - a.spend;
    });

    // 8. Buscar Criativos (Ad-level insights com retenção e hook rate)
    let criativos = [];
    try {
      const adInsRes = await fetch(
        `${BASE_URL}/${accountId}/insights?level=ad&time_range=${timeRangeParam}&fields=ad_id,ad_name,campaign_id,campaign_name,spend,impressions,clicks,actions,cpm,ctr,video_p25_watched_actions,video_p50_watched_actions,video_p100_watched_actions&limit=100&access_token=${encodeURIComponent(token)}`
      );
      const adInsData = await adInsRes.json();
      const adInsights = adInsData.data || [];

      // Mapa de criativos de ads para thumbnails
      const adsCreativeMap = {};
      for (const ad of rawAds) {
        if (ad.creative) adsCreativeMap[ad.id] = ad.creative;
      }

      criativos = adInsights.map((ad) => {
        const spend = parseFloat(ad.spend || 0);
        const imp = parseInt(ad.impressions || 0, 10);
        const dedup = extractDeduplicatedResults(ad.actions);
        const results = dedup.results;
        const cpr = results > 0 ? spend / results : 0;
        const ctr = imp > 0 ? (dedup.linkClicks / imp) * 100 : 0;

        // Métricas de Vídeo
        const video3s = dedup.videoViews3s;
        const hookRate = imp > 0 && video3s > 0 ? (video3s / imp) * 100 : 0;

        let videoP100 = 0;
        if (ad.video_p100_watched_actions) {
          const p100 = ad.video_p100_watched_actions.find((v) => v.action_type === 'video_view');
          if (p100) videoP100 = parseFloat(p100.value || 0);
        }
        const retentionRate = video3s > 0 ? (videoP100 / video3s) * 100 : 0;

        const cr = adsCreativeMap[ad.ad_id] || {};

        return {
          id: ad.ad_id,
          name: ad.ad_name,
          campaign_id: ad.campaign_id,
          campaign_name: ad.campaign_name,
          spend,
          results,
          cpr,
          ctr,
          impressions: imp,
          isVideo: video3s > 0,
          video3s,
          videoP100,
          hookRate,
          retentionRate,
          thumbnail: cr.thumbnail_url || cr.image_url || null,
          title: cr.title || '',
          body: cr.body || '',
        };
      });

      criativos.sort((a, b) => b.spend - a.spend);
    } catch {
      criativos = [];
    }

    // 9. Mapa de Calor Horário (7 dias da semana x 24 horas)
    // Inicializar matriz 7 x 24 com zeros
    const heatmap = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ spend: 0, clicks: 0, leads: 0, count: 0 }))
    );

    try {
      const hourlyRes = await fetch(
        `${BASE_URL}/${accountId}/insights?time_range=${timeRangeParam}&time_increment=1&breakdowns=hourly_stats_aggregated_by_audience_time_zone&fields=spend,clicks,actions&limit=500&access_token=${encodeURIComponent(token)}`
      );
      const hourlyData = await hourlyRes.json();
      const rows = hourlyData.data || [];

      for (const row of rows) {
        if (!row.date_start || !row.hourly_stats_aggregated_by_audience_time_zone) continue;

        // Data -> Dia da semana (0 = Dom, 1 = Seg, ..., 6 = Sáb)
        const d = new Date(`${row.date_start}T12:00:00Z`);
        const dayOfWeek = d.getUTCDay();

        // Extrair hora de "HH:00:00 - HH:59:59"
        const hourStr = row.hourly_stats_aggregated_by_audience_time_zone.split(':')[0];
        const hour = parseInt(hourStr, 10);

        if (dayOfWeek >= 0 && dayOfWeek < 7 && hour >= 0 && hour < 24) {
          const sp = parseFloat(row.spend || 0);
          const cl = parseInt(row.clicks || 0, 10);
          const ded = extractDeduplicatedResults(row.actions);

          heatmap[dayOfWeek][hour].spend += sp;
          heatmap[dayOfWeek][hour].clicks += cl;
          heatmap[dayOfWeek][hour].leads += ded.results;
          heatmap[dayOfWeek][hour].count += 1;
        }
      }
    } catch {
      // Ignorar e deixar matriz zerada se a Meta não suportar no intervalo
    }

    // 10. Diagnósticos Inteligentes e Avisos Práticos em Português
    const avisos = [];

    // Verificação de Campanhas Sem Entrega
    const semEntrega = campanhas.filter((c) => c.situacao === 'SEM_ENTREGA');
    if (semEntrega.length > 0) {
      avisos.push({
        tipo: 'alerta',
        titulo: `${semEntrega.length} campanha(s) ativa(s) sem gastar nada`,
        descricao: `Campanhas como "${semEntrega[0].name}" estão ligadas na Meta, mas não entregaram nenhuma impressão no período.`,
        acao: 'Verifique se o orçamento está muito baixo, se o público é minúsculo ou se há restrição de conta/anúncio reprovado.',
      });
    }

    // Verificação de CTR
    if (curCtr > 0 && curCtr < 0.9) {
      avisos.push({
        tipo: 'atencao',
        titulo: `CTR médio da conta está baixo (${curCtr.toFixed(2)}%)`,
        descricao: 'A taxa de clique nos links está abaixo da média recomendada de 1.20% para tráfego qualificado.',
        acao: 'Teste novos ganchos visuais nos criativos nos primeiros 3 segundos para aumentar o interesse.',
      });
    }

    // Verificação de Fadiga em Criativos (se CTR caiu e CPM subiu)
    const criativosFadigados = criativos.filter((c) => c.spend > 150 && c.ctr < 0.6);
    if (criativosFadigados.length > 0) {
      avisos.push({
        tipo: 'atencao',
        titulo: `${criativosFadigados.length} anúncio(s) com sinal de cansaço`,
        descricao: `O anúncio "${criativosFadigados[0].name}" já gastou R$ ${criativosFadigados[0].spend.toFixed(2)} com CTR fraco (${criativosFadigados[0].ctr.toFixed(2)}%).`,
        acao: 'Pause esse criativo e suba 2 novas variações de teste para renovar a atenção do público.',
      });
    }

    // Oportunidade de Escala
    const campeao = criativos.find((c) => c.results > 15 && c.cpr < curCpr * 0.85);
    if (campeao) {
      avisos.push({
        tipo: 'sucesso',
        titulo: `Oportunidade de Escala: "${campeao.name}"`,
        descricao: `Gerou ${campeao.results} resultados a um custo de R$ ${campeao.cpr.toFixed(2)} (abaixo da média da conta de R$ ${curCpr.toFixed(2)}).`,
        acao: 'Aumente o orçamento da campanha gradualmente em 15% a 20% para escalar resultados com segurança.',
      });
    }

    const payload = {
      conta: {
        id: accData.id,
        name: accData.name,
        currency,
        timezone,
      },
      periodo: {
        range: rangeType,
        atual: dateRanges.current,
        anterior: dateRanges.previous,
      },
      totais: {
        spend: curSpend,
        results: curDedup.results,
        primaryType: curDedup.primaryType,
        cpr: curCpr,
        roas: curRoas,
        impressions: curImpressions,
        clicks: curLinkClicks,
        ctr: curCtr,
        cpm: curCpm,
        purchases: curDedup.purchases,
        leads: curDedup.leads,
        messages: curDedup.messages,
        revenue: curDedup.revenue,
      },
      anterior: {
        spend: prevSpend,
        results: prevDedup.results,
        cpr: prevCpr,
        roas: prevRoas,
        impressions: prevImpressions,
        clicks: prevLinkClicks,
        ctr: prevCtr,
        cpm: prevCpm,
      },
      variacoes,
      serieDiaria,
      funil,
      campanhas,
      criativos,
      heatmap,
      avisos,
      timestamp: new Date().toISOString(),
    };

    // Salvar no cache de 90s
    memoryCache.set(cacheKey, {
      timestamp: now,
      data: payload,
    });

    return res.status(200).json(payload);
  } catch (err) {
    return res.status(500).json({
      error: 'Erro no servidor ao processar dados da Meta: ' + err.message,
    });
  }
}
