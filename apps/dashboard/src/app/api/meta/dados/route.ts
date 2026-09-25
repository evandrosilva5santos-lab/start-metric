import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptToken } from "@/lib/meta/token";
import { isPainelAuthorized, PAINEL_COOKIE_NAME } from "@/lib/auth/painel";

export const dynamic = "force-dynamic";

const CACHE_TTL_MS = 180 * 1000;
const GRAPH_TIMEOUT_MS = 15_000;
const memoryCache = new Map<string, { timestamp: number; data: Record<string, unknown> }>();

function graphFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, { ...init, signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS) });
}

type MetaAction = { action_type: string; value: string };

type MetaInsightRow = {
  date_start?: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
  campaign_id?: string;
  campaign_name?: string;
  ad_id?: string;
  ad_name?: string;
  video_p100_watched_actions?: MetaAction[];
  hourly_stats_aggregated_by_audience_time_zone?: string;
};

type MetaError = { code: number; message: string };
type MetaList<T> = { data?: T[]; error?: MetaError };

type MetaAccount = {
  id: string;
  name: string;
  currency?: string;
  timezone_name?: string;
  error?: MetaError;
};

type MetaCampaign = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
};

type MetaAdset = {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  effective_status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  learning_stage_info?: { status?: string };
  optimization_goal?: string;
};

type MetaCreativeRef = {
  id: string;
  name?: string;
  thumbnail_url?: string;
  image_url?: string;
  title?: string;
  body?: string;
};

type MetaAd = {
  id: string;
  name: string;
  campaign_id: string;
  adset_id: string;
  status: string;
  effective_status: string;
  creative?: MetaCreativeRef;
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

type CriativoRow = {
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

type Aviso = { tipo: string; titulo: string; descricao: string; acao: string };

function getAccountLocalDate(timezone: string, offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone || "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(d);
}

function calculateDateRanges(rangeType: string, timezone: string) {
  const todayStr = getAccountLocalDate(timezone, 0);
  const yesterdayStr = getAccountLocalDate(timezone, -1);

  let curStart = todayStr;
  let curStop = todayStr;
  let prevStart = yesterdayStr;
  let prevStop = yesterdayStr;

  switch (rangeType) {
    case "today":
      curStart = todayStr;
      curStop = todayStr;
      prevStart = yesterdayStr;
      prevStop = yesterdayStr;
      break;

    case "yesterday":
      curStart = yesterdayStr;
      curStop = yesterdayStr;
      prevStart = getAccountLocalDate(timezone, -2);
      prevStop = getAccountLocalDate(timezone, -2);
      break;

    case "last_7d":
      curStart = getAccountLocalDate(timezone, -7);
      curStop = yesterdayStr;
      prevStart = getAccountLocalDate(timezone, -14);
      prevStop = getAccountLocalDate(timezone, -8);
      break;

    case "last_14d":
      curStart = getAccountLocalDate(timezone, -14);
      curStop = yesterdayStr;
      prevStart = getAccountLocalDate(timezone, -28);
      prevStop = getAccountLocalDate(timezone, -15);
      break;

    case "this_month": {
      const parts = todayStr.split("-");
      curStart = `${parts[0]}-${parts[1]}-01`;
      curStop = todayStr;
      const d = new Date(`${parts[0]}-${parts[1]}-01T12:00:00Z`);
      d.setMonth(d.getMonth() - 1);
      const prevYear = d.getFullYear();
      const prevMonth = String(d.getMonth() + 1).padStart(2, "0");
      prevStart = `${prevYear}-${prevMonth}-01`;
      const curDay = parseInt(parts[2], 10);
      prevStop = `${prevYear}-${prevMonth}-${String(Math.min(curDay, 28)).padStart(2, "0")}`;
      break;
    }

    case "last_month": {
      const parts = todayStr.split("-");
      const d = new Date(`${parts[0]}-${parts[1]}-01T12:00:00Z`);
      d.setMonth(d.getMonth() - 1);
      const lmYear = d.getFullYear();
      const lmMonth = String(d.getMonth() + 1).padStart(2, "0");
      const lastDay = new Date(lmYear, d.getMonth() + 1, 0).getDate();
      curStart = `${lmYear}-${lmMonth}-01`;
      curStop = `${lmYear}-${lmMonth}-${lastDay}`;

      d.setMonth(d.getMonth() - 1);
      const prevYear = d.getFullYear();
      const prevMonth = String(d.getMonth() + 1).padStart(2, "0");
      const prevLastDay = new Date(prevYear, d.getMonth() + 1, 0).getDate();
      prevStart = `${prevYear}-${prevMonth}-01`;
      prevStop = `${prevYear}-${prevMonth}-${prevLastDay}`;
      break;
    }

    case "last_30d":
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

function extractDeduplicatedResults(actions: MetaAction[] = [], actionValues: MetaAction[] = []) {
  const actMap: Record<string, number> = {};
  for (const a of actions) {
    actMap[a.action_type] = parseFloat(a.value || "0");
  }

  let purchases = 0;
  if (actMap["purchase"] !== undefined) purchases = actMap["purchase"];
  else if (actMap["omni_purchase"] !== undefined) purchases = actMap["omni_purchase"];
  else if (actMap["offsite_conversion.fb_pixel_purchase"] !== undefined) purchases = actMap["offsite_conversion.fb_pixel_purchase"];

  let leads = 0;
  if (actMap["lead"] !== undefined) leads = actMap["lead"];
  else if (actMap["onsite_conversion.lead_grouped"] !== undefined) leads = actMap["onsite_conversion.lead_grouped"];
  else if (actMap["offsite_complete_registration_add_meta_leads"] !== undefined) leads = actMap["offsite_complete_registration_add_meta_leads"];
  else if (actMap["offsite_conversion.fb_pixel_lead"] !== undefined) leads = actMap["offsite_conversion.fb_pixel_lead"];

  let messages = 0;
  if (actMap["onsite_conversion.messaging_conversation_started_7d"] !== undefined) {
    messages = actMap["onsite_conversion.messaging_conversation_started_7d"];
  } else if (actMap["onsite_conversion.messaging_first_reply"] !== undefined) {
    messages = actMap["onsite_conversion.messaging_first_reply"];
  }

  const linkClicks = actMap["link_click"] || 0;
  const landingPageViews = actMap["landing_page_view"] || actMap["offsite_content_view"] || 0;
  const checkouts = actMap["initiate_checkout"] || actMap["omni_initiated_checkout"] || 0;
  const videoViews3s = actMap["video_view"] || 0;

  let revenue = 0;
  for (const av of actionValues) {
    if (av.action_type === "purchase" || av.action_type === "omni_purchase" || av.action_type === "offsite_conversion.fb_pixel_purchase") {
      revenue = Math.max(revenue, parseFloat(av.value || "0"));
    }
  }

  let primaryType = "leads";
  let primaryCount = leads;
  if (purchases > 0 && purchases >= leads) {
    primaryType = "compras";
    primaryCount = purchases;
  } else if (leads === 0 && messages > 0) {
    primaryType = "mensagens";
    primaryCount = messages;
  } else if (primaryCount === 0 && purchases > 0) {
    primaryType = "compras";
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

export async function GET(req: NextRequest): Promise<NextResponse> {
  const searchParams = req.nextUrl.searchParams;
  const accountId = searchParams.get("account_id");
  if (!accountId || !/^act_[0-9]+$/.test(accountId)) {
    return NextResponse.json({ error: "Parâmetro account_id é obrigatório (formato act_...)" }, { status: 400 });
  }
  const rangeType = searchParams.get("range") || "last_30d";
  const forceFresh = searchParams.get("fresh") === "true";

  const painelCookie = req.cookies.get(PAINEL_COOKIE_NAME)?.value;
  const isPainel = await isPainelAuthorized(painelCookie);

  let user = null;
  let supabase = null;
  try {
    supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase opcional se autenticado via PAINEL_SENHA
  }

  if (!isPainel && !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const envToken =
    process.env.META_TOKEN ||
    process.env.META_SYSTEM_TOKEN ||
    process.env.META_USER_TOKEN;

  let token: string | null = envToken || null;
  let orgId = "default_org";

  if (supabase && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (profile?.org_id) {
      orgId = profile.org_id;

      if (!token) {
        const { data: adAccount } = await supabase
          .from("ad_accounts")
          .select("token_encrypted")
          .eq("org_id", orgId)
          .eq("platform", "meta")
          .eq("external_id", accountId)
          .maybeSingle();

        if (adAccount?.token_encrypted) {
          try {
            token = await decryptToken(adAccount.token_encrypted, supabase);
          } catch (err) {
            console.error("[meta/dados] Falha ao descriptografar token:", err);
          }
        }
      }
    }
  }

  if (!token) {
    return NextResponse.json(
      { error: "A conexão com a Meta desta conta expirou ou META_TOKEN não está configurado." },
      { status: 403 },
    );
  }

  const cacheKey = `${orgId}_${accountId}_${rangeType}`;
  const now = Date.now();

  if (!forceFresh && memoryCache.has(cacheKey)) {
    const cached = memoryCache.get(cacheKey)!;
    if (now - cached.timestamp < CACHE_TTL_MS) {
      return NextResponse.json({
        ...cached.data,
        cached: true,
        cacheAgeSeconds: Math.round((now - cached.timestamp) / 1000),
      });
    }
  }

  const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";
  const BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;

  try {
    const accRes = await graphFetch(
      `${BASE_URL}/${accountId}?fields=id,name,currency,timezone_name,account_status,amount_spent&access_token=${encodeURIComponent(token)}`
    );
    const accData: MetaAccount = await accRes.json();

    if (accData.error) {
      if (accData.error.code === 17 && memoryCache.has(cacheKey)) {
        return NextResponse.json({
          ...memoryCache.get(cacheKey)!.data,
          cached: true,
          rateLimitHit: true,
          warning: "Limite temporário da Meta atingido. Servindo dados do cache de 90s.",
        });
      }
      if (accData.error.code === 190) {
        if (supabase) void supabase.from("ad_accounts").update({ status: "expired" }).eq("external_id", accountId);
        return NextResponse.json(
          {
            error: `Erro na conta (190): Sua sessão com a Meta expirou ou foi invalidada pelo Facebook. Reconecte sua conta em Configurações > Meta Ads.`,
            code: 190,
            tokenExpired: true,
          },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: `Erro na conta (${accData.error.code}): ${accData.error.message}` }, { status: 400 });
    }

    const timezone = accData.timezone_name || "America/Sao_Paulo";
    const currency = accData.currency || "BRL";
    const dateRanges = calculateDateRanges(rangeType, timezone);

    const timeRangeParam = encodeURIComponent(JSON.stringify(dateRanges.current));
    const prevRangeParam = encodeURIComponent(JSON.stringify(dateRanges.previous));
    const fieldsInsights = "spend,impressions,clicks,actions,action_values,cpm,ctr";

    const [
      currentInsightsRes,
      prevInsightsRes,
      dailyInsightsRes,
      campaignsRes,
      adsetsRes,
      adsRes,
      campInsRes,
      adInsRes,
    ] = await Promise.all([
      graphFetch(`${BASE_URL}/${accountId}/insights?time_range=${timeRangeParam}&fields=${fieldsInsights}&access_token=${encodeURIComponent(token)}`),
      graphFetch(`${BASE_URL}/${accountId}/insights?time_range=${prevRangeParam}&fields=${fieldsInsights}&access_token=${encodeURIComponent(token)}`),
      graphFetch(`${BASE_URL}/${accountId}/insights?time_range=${timeRangeParam}&time_increment=1&fields=${fieldsInsights}&access_token=${encodeURIComponent(token)}`),
      graphFetch(`${BASE_URL}/${accountId}/campaigns?fields=id,name,status,effective_status,objective,daily_budget,lifetime_budget&limit=100&access_token=${encodeURIComponent(token)}`),
      graphFetch(`${BASE_URL}/${accountId}/adsets?fields=id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,learning_stage_info,optimization_goal&limit=100&access_token=${encodeURIComponent(token)}`),
      graphFetch(`${BASE_URL}/${accountId}/ads?fields=id,name,campaign_id,adset_id,status,effective_status,creative{id,name,thumbnail_url,image_url,title,body}&limit=100&access_token=${encodeURIComponent(token)}`),
      graphFetch(`${BASE_URL}/${accountId}/insights?level=campaign&time_range=${timeRangeParam}&fields=campaign_id,campaign_name,spend,impressions,clicks,actions,cpm,ctr&limit=100&access_token=${encodeURIComponent(token)}`),
      graphFetch(`${BASE_URL}/${accountId}/insights?level=ad&time_range=${timeRangeParam}&fields=ad_id,ad_name,campaign_id,campaign_name,spend,impressions,clicks,actions,cpm,ctr,video_p25_watched_actions,video_p50_watched_actions,video_p100_watched_actions&limit=100&access_token=${encodeURIComponent(token)}`),
    ]);

    const [curRaw, prevRaw, dailyRaw, campRaw, adsetsRaw, adsRaw, campInsData, adInsData] = await Promise.all([
      currentInsightsRes.json() as Promise<MetaList<MetaInsightRow>>,
      prevInsightsRes.json() as Promise<MetaList<MetaInsightRow>>,
      dailyInsightsRes.json() as Promise<MetaList<MetaInsightRow>>,
      campaignsRes.json() as Promise<MetaList<MetaCampaign>>,
      adsetsRes.json() as Promise<MetaList<MetaAdset>>,
      adsRes.json() as Promise<MetaList<MetaAd>>,
      campInsRes.json() as Promise<MetaList<MetaInsightRow>>,
      adInsRes.json() as Promise<MetaList<MetaInsightRow>>,
    ]);

    for (const r of [curRaw, prevRaw, dailyRaw, campRaw]) {
      if (r?.error?.code === 17 && memoryCache.has(cacheKey)) {
        return NextResponse.json({
          ...memoryCache.get(cacheKey)!.data,
          cached: true,
          rateLimitHit: true,
          warning: "Limite de consultas da Meta atingido. Exibindo dados recentes em cache.",
        });
      }
      if (r?.error?.code === 190) {
        if (supabase) void supabase.from("ad_accounts").update({ status: "expired" }).eq("external_id", accountId);
        return NextResponse.json(
          {
            error: `Erro na conta (190): Sua sessão com a Meta expirou ou foi invalidada pelo Facebook. Reconecte sua conta em Configurações > Meta Ads.`,
            code: 190,
            tokenExpired: true,
          },
          { status: 400 }
        );
      }
    }

    const curData = curRaw.data?.[0] || {};
    const curSpend = parseFloat(curData.spend || "0");
    const curImpressions = parseInt(curData.impressions || "0", 10);
    const curClicks = parseInt(curData.clicks || "0", 10);
    const curDedup = extractDeduplicatedResults(curData.actions, curData.action_values);

    const curLinkClicks = curDedup.linkClicks || curClicks;
    const curCpm = curImpressions > 0 ? (curSpend / curImpressions) * 1000 : 0;
    const curCtr = curImpressions > 0 ? (curLinkClicks / curImpressions) * 100 : 0;
    const curCpr = curDedup.results > 0 ? curSpend / curDedup.results : 0;
    const curRoas = curSpend > 0 && curDedup.revenue > 0 ? curDedup.revenue / curSpend : 0;

    const prevData = prevRaw.data?.[0] || {};
    const prevSpend = parseFloat(prevData.spend || "0");
    const prevImpressions = parseInt(prevData.impressions || "0", 10);
    const prevClicks = parseInt(prevData.clicks || "0", 10);
    const prevDedup = extractDeduplicatedResults(prevData.actions, prevData.action_values);

    const prevLinkClicks = prevDedup.linkClicks || prevClicks;
    const prevCpm = prevImpressions > 0 ? (prevSpend / prevImpressions) * 1000 : 0;
    const prevCtr = prevImpressions > 0 ? (prevLinkClicks / prevImpressions) * 100 : 0;
    const prevCpr = prevDedup.results > 0 ? prevSpend / prevDedup.results : 0;
    const prevRoas = prevSpend > 0 && prevDedup.revenue > 0 ? prevDedup.revenue / prevSpend : 0;

    const calcVar = (curr: number, prev: number) => {
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

    const dailyList = dailyRaw.data || [];
    const serieDiaria = dailyList.map((d) => {
      const daySpend = parseFloat(d.spend || "0");
      const dayImp = parseInt(d.impressions || "0", 10);
      const dayDedup = extractDeduplicatedResults(d.actions, d.action_values);
      const dayCpr = dayDedup.results > 0 ? daySpend / dayDedup.results : 0;
      const dayCtr = dayImp > 0 ? (dayDedup.linkClicks / dayImp) * 100 : 0;

      const parts = (d.date_start || "").split("-");
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

    const funilImpressions = curImpressions;
    const funilLinkClicks = curLinkClicks;
    // Sem fallback fictício: quando o pixel não trackeia, exibimos 0 em vez
    // de inventar valores (evita diagnóstico de gargalo sobre dados fabricados).
    const funilLandingViews = curDedup.landingPageViews;
    const funilCheckouts = curDedup.checkouts;
    const funilResults = curDedup.results;

    const rateImpToClick = funilImpressions > 0 ? (funilLinkClicks / funilImpressions) * 100 : 0;
    const rateClickToPage = funilLinkClicks > 0 ? (funilLandingViews / funilLinkClicks) * 100 : 0;
    const ratePageToCheckout = funilLandingViews > 0 ? (funilCheckouts / funilLandingViews) * 100 : 0;
    const rateCheckoutToResult = funilCheckouts > 0 ? (funilResults / funilCheckouts) * 100 : 0;

    let gargaloDiagnostico = "Funil equilibrado no período.";
    let gargaloEtapa = "Nenhum";

    if (rateImpToClick < 0.8 && funilImpressions > 1000) {
      gargaloEtapa = "Criativo (Impressão -> Clique)";
      gargaloDiagnostico = `CTR baixo (${rateImpToClick.toFixed(2)}%). Os anúncios não estão capturando a atenção do público nos primeiros segundos.`;
    } else if (funilLandingViews > 0 && rateClickToPage < 65 && funilLinkClicks > 50) {
      gargaloEtapa = "Carregamento do Site (Clique -> Visita)";
      gargaloDiagnostico = `Apenas ${rateClickToPage.toFixed(1)}% dos que clicam chegam a abrir sua página. O site pode estar lento ou o Pixel com delay.`;
    } else if (ratePageToCheckout < 3 && funilLandingViews > 100) {
      gargaloEtapa = "Proposta da Página (Visita -> Checkout/Formulário)";
      gargaloDiagnostico = `Muitos visitantes na página (${funilLandingViews}), mas poucos iniciam conversão (${ratePageToCheckout.toFixed(1)}%). Oferta ou botão de ação precisam de mais clareza.`;
    } else if (rateCheckoutToResult < 25 && funilCheckouts > 10) {
      gargaloEtapa = "Fechamento / Checkout (Início -> Conclusão)";
      gargaloDiagnostico = `Alta desistência no fechamento (apenas ${rateCheckoutToResult.toFixed(1)}% finalizam). Verifique atrito no checkout ou formulário extenso.`;
    }

    const funil = {
      etapas: [
        { nome: "Impressões", valor: funilImpressions, pctAnterior: 100, pctTopo: 100 },
        { nome: "Cliques no Link", valor: funilLinkClicks, pctAnterior: rateImpToClick, pctTopo: rateImpToClick },
        { nome: "Visitas à Página", valor: funilLandingViews, pctAnterior: rateClickToPage, pctTopo: funilImpressions > 0 ? (funilLandingViews / funilImpressions) * 100 : 0 },
        { nome: "Início de Ação", valor: funilCheckouts, pctAnterior: ratePageToCheckout, pctTopo: funilImpressions > 0 ? (funilCheckouts / funilImpressions) * 100 : 0 },
        { nome: curDedup.primaryType === "compras" ? "Compras" : "Resultados (Leads)", valor: funilResults, pctAnterior: rateCheckoutToResult, pctTopo: funilImpressions > 0 ? (funilResults / funilImpressions) * 100 : 0 },
      ],
      gargalo: {
        etapa: gargaloEtapa,
        explicacao: gargaloDiagnostico,
      },
    };

    const campInsights: MetaInsightRow[] = campInsData?.data || [];
    const campInsightsMap: Record<string, MetaInsightRow> = {};
    for (const ci of campInsights) {
      if (ci.campaign_id) campInsightsMap[ci.campaign_id] = ci;
    }

    const rawAdsets = adsetsRaw.data || [];
    const adsetsByCampaign: Record<string, AdsetDetail[]> = {};
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
        learning_stage: adset.learning_stage_info?.status || "NORMAL",
        optimization_goal: adset.optimization_goal || "",
      });
    }

    const rawAds = adsRaw.data || [];
    const adsByCampaign: Record<string, AdDetail[]> = {};
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
          name: ad.creative.name || "",
          thumbnail_url: ad.creative.thumbnail_url || ad.creative.image_url || "",
          title: ad.creative.title || "",
          body: ad.creative.body || "",
        } : null,
      });
    }

    const rawCampaigns = campRaw.data || [];
    const campanhas = rawCampaigns.map((camp) => {
      const ins = campInsightsMap[camp.id] || {};
      const spend = parseFloat(ins.spend || "0");
      const imp = parseInt(ins.impressions || "0", 10);
      const dedup = extractDeduplicatedResults(ins.actions);
      const results = dedup.results;
      const cpr = results > 0 ? spend / results : 0;
      const ctr = imp > 0 ? (dedup.linkClicks / imp) * 100 : 0;
      const cpm = imp > 0 ? (spend / imp) * 1000 : 0;

      let dailyBudget = camp.daily_budget ? parseFloat(camp.daily_budget) / 100 : null;
      let budgetType = "Campanha (CBO)";
      if (!dailyBudget && adsetsByCampaign[camp.id]) {
        const sumAdsets = adsetsByCampaign[camp.id].reduce((acc, a) => acc + (a.daily_budget || 0), 0);
        if (sumAdsets > 0) {
          dailyBudget = sumAdsets;
          budgetType = "Conjunto (ABO)";
        }
      }

      const isConfigActive = camp.status === "ACTIVE" || camp.effective_status === "ACTIVE";
      let situacao = "PAUSADA";
      let situacaoLabel = "Pausada";
      let situacaoColor = "gray";

      if (isConfigActive) {
        if (spend === 0) {
          situacao = "SEM_ENTREGA";
          situacaoLabel = "Sem entrega";
          situacaoColor = "amber";
        } else {
          situacao = "ATIVA";
          situacaoLabel = "Ativa";
          situacaoColor = "emerald";
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

    campanhas.sort((a, b) => {
      if (a.situacao === "ATIVA" && b.situacao !== "ATIVA") return -1;
      if (a.situacao !== "ATIVA" && b.situacao === "ATIVA") return 1;
      return b.spend - a.spend;
    });

    let criativos: CriativoRow[] = [];
    const adInsights = adInsData?.data || [];
    const adsCreativeMap: Record<string, MetaCreativeRef> = {};
    for (const ad of rawAds) {
      if (ad.creative) adsCreativeMap[ad.id] = ad.creative;
    }

      criativos = adInsights.map((ad) => {
        const spend = parseFloat(ad.spend || "0");
        const imp = parseInt(ad.impressions || "0", 10);
        const dedup = extractDeduplicatedResults(ad.actions);
        const results = dedup.results;
        const cpr = results > 0 ? spend / results : 0;
        const ctr = imp > 0 ? (dedup.linkClicks / imp) * 100 : 0;

        const video3s = dedup.videoViews3s;
        const hookRate = imp > 0 && video3s > 0 ? (video3s / imp) * 100 : 0;

        let videoP100 = 0;
        if (ad.video_p100_watched_actions) {
          const p100 = ad.video_p100_watched_actions.find((v) => v.action_type === "video_view");
          if (p100) videoP100 = parseFloat(p100.value || "0");
        }
        const retentionRate = video3s > 0 ? (videoP100 / video3s) * 100 : 0;

        const cr: Partial<MetaCreativeRef> = (ad.ad_id ? adsCreativeMap[ad.ad_id] : undefined) ?? {};

        return {
          id: ad.ad_id || "",
          name: ad.ad_name || "",
          campaign_id: ad.campaign_id || "",
          campaign_name: ad.campaign_name || "",
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
          thumbnail: cr.image_url || cr.thumbnail_url || null,
          title: cr.title || "",
          body: cr.body || "",
        };
      });

      criativos.sort((a, b) => b.spend - a.spend);

    const heatmap = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => ({ spend: 0, clicks: 0, leads: 0, count: 0 }))
    );

    try {
      const hourlyRes = await graphFetch(
        `${BASE_URL}/${accountId}/insights?time_range=${timeRangeParam}&time_increment=1&breakdowns=hourly_stats_aggregated_by_audience_time_zone&fields=spend,clicks,actions&limit=500&access_token=${encodeURIComponent(token)}`
      );
      const hourlyData = await hourlyRes.json();
      const rows = hourlyData.data || [];

      for (const row of rows) {
        if (!row.date_start || !row.hourly_stats_aggregated_by_audience_time_zone) continue;

        const d = new Date(`${row.date_start}T12:00:00Z`);
        const dayOfWeek = d.getUTCDay();
        const hourStr = row.hourly_stats_aggregated_by_audience_time_zone.split(":")[0];
        const hour = parseInt(hourStr, 10);

        if (dayOfWeek >= 0 && dayOfWeek < 7 && hour >= 0 && hour < 24) {
          const sp = parseFloat(row.spend || "0");
          const cl = parseInt(row.clicks || "0", 10);
          const ded = extractDeduplicatedResults(row.actions);

          heatmap[dayOfWeek][hour].spend += sp;
          heatmap[dayOfWeek][hour].clicks += cl;
          heatmap[dayOfWeek][hour].leads += ded.results;
          heatmap[dayOfWeek][hour].count += 1;
        }
      }
    } catch {
      // Ignorar fallback
    }

    const avisos: Aviso[] = [];
    const semEntrega = campanhas.filter((c) => c.situacao === "SEM_ENTREGA");
    if (semEntrega.length > 0) {
      avisos.push({
        tipo: "alerta",
        titulo: `${semEntrega.length} campanha(s) ativa(s) sem gastar nada`,
        descricao: `Campanhas como "${semEntrega[0].name}" estão ligadas na Meta, mas não entregaram nenhuma impressão no período.`,
        acao: "Verifique se o orçamento está muito baixo, se o público é minúsculo ou se há restrição de conta/anúncio reprovado.",
      });
    }

    if (curCtr > 0 && curCtr < 0.9) {
      avisos.push({
        tipo: "atencao",
        titulo: `CTR médio da conta está baixo (${curCtr.toFixed(2)}%)`,
        descricao: "A taxa de clique nos links está abaixo da média recomendada de 1.20% para tráfego qualificado.",
        acao: "Teste novos ganchos visuais nos criativos nos primeiros 3 segundos para aumentar o interesse.",
      });
    }

    const criativosFadigados = criativos.filter((c) => c.spend > 150 && c.ctr < 0.6);
    if (criativosFadigados.length > 0) {
      avisos.push({
        tipo: "atencao",
        titulo: `${criativosFadigados.length} anúncio(s) com sinal de cansaço`,
        descricao: `O anúncio "${criativosFadigados[0].name}" já gastou R$ ${criativosFadigados[0].spend.toFixed(2)} com CTR fraco (${criativosFadigados[0].ctr.toFixed(2)}%).`,
        acao: "Pause esse criativo e suba 2 novas variações de teste para renovar a atenção do público.",
      });
    }

    const campeao = criativos.find((c) => c.results > 15 && c.cpr < curCpr * 0.85);
    if (campeao) {
      avisos.push({
        tipo: "sucesso",
        titulo: `Oportunidade de Escala: "${campeao.name}"`,
        descricao: `Gerou ${campeao.results} resultados a um custo de R$ ${campeao.cpr.toFixed(2)} (abaixo da média da conta de R$ ${curCpr.toFixed(2)}).`,
        acao: "Aumente o orçamento da campanha gradualmente em 15% a 20% para escalar resultados com segurança.",
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

    if (memoryCache.size >= 200) {
      const oldestKey = memoryCache.keys().next().value;
      if (oldestKey !== undefined) memoryCache.delete(oldestKey);
    }
    memoryCache.set(cacheKey, {
      timestamp: now,
      data: payload,
    });

    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Erro interno no servidor: " + message }, { status: 500 });
  }
}
