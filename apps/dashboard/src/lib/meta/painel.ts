// Monta a resposta do painel a partir da Graph API: coleta paginada, regras de
// conversão, funil, campanhas, criativos, horário e diagnóstico. A rota
// /api/meta/dados só cuida de login, token, cache e do erro 17.

import { mapLimit, type GraphClient } from "./graph";
import {
  LIMITES,
  NOME_RESULTADO,
  aprendizado,
  campoDeVideo,
  contar,
  custoPor,
  deCentavos,
  diaDaSemana,
  estaCansado,
  listaDeDias,
  metricas,
  periodos,
  situacao,
  taxa,
  tipoDaCampanha,
  tipoDoConjunto,
  tipoPorObjetivo,
  valorDaConversao,
  variacao,
  type MetaAction,
  type Situacao,
  type TipoResultado,
} from "./regras";
import type {
  AdDetail,
  AdsetDetail,
  Aviso,
  CampaignSituation,
  DadosResponse,
  DailyPoint,
  FunnelStep,
  HeatmapCell,
  MetaCampaign,
  MetaCreative,
} from "./dados-types";

// ---------------------------------------------------------------- tipos da Meta

type MetaAccount = { id: string; name: string; currency?: string; timezone_name?: string; account_status?: number };

type MetaCampaignEntity = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective: string;
  daily_budget?: string;
  lifetime_budget?: string;
};

type MetaAdsetEntity = {
  id: string;
  name: string;
  campaign_id: string;
  status: string;
  effective_status: string;
  daily_budget?: string;
  lifetime_budget?: string;
  learning_stage_info?: { status?: string };
  optimization_goal?: string;
  destination_type?: string;
  promoted_object?: { custom_event_type?: string };
};

type MetaAdEntity = {
  id: string;
  name: string;
  campaign_id: string;
  adset_id: string;
  status: string;
  effective_status: string;
  creative?: { id: string; name?: string; thumbnail_url?: string; image_url?: string; title?: string; body?: string; object_type?: string };
};

type InsightRow = {
  campaign_id?: string;
  campaign_name?: string;
  objective?: string;
  ad_id?: string;
  ad_name?: string;
  date_start?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  inline_link_clicks?: string;
  actions?: MetaAction[];
  action_values?: MetaAction[];
  video_p100_watched_actions?: MetaAction[];
  hourly_stats_aggregated_by_advertiser_time_zone?: string;
};

const num = (v: string | undefined) => Number(v ?? 0) || 0;
const totaisDe = (r: InsightRow | undefined) => ({
  gasto: num(r?.spend),
  impressoes: num(r?.impressions),
  cliques: num(r?.inline_link_clicks),
  alcance: num(r?.reach),
});
const rotulo = (tipo: TipoResultado | null) => (tipo ? NOME_RESULTADO[tipo].varios : "resultados");

const SITUACAO: Record<Situacao, { situacao: CampaignSituation; label: string; color: string }> = {
  ativa: { situacao: "ATIVA", label: "Ativa", color: "emerald" },
  sem_entrega: { situacao: "SEM_ENTREGA", label: "Sem entrega", color: "amber" },
  com_problema: { situacao: "PAUSADA", label: "Com problema", color: "red" },
  em_analise: { situacao: "PAUSADA", label: "Em análise", color: "gray" },
  encerrada: { situacao: "PAUSADA", label: "Encerrada", color: "gray" },
  pausada: { situacao: "PAUSADA", label: "Pausada", color: "gray" },
};

const STATUS_CONTA: Record<number, string> = {
  2: "desativada pela Meta",
  3: "com pagamento pendente",
  7: "em revisão de risco da Meta",
  8: "com liquidação pendente",
  9: "no período de carência de pagamento",
  100: "com fechamento pendente",
  101: "fechada",
};

// ---------------------------------------------------------------- montagem

export async function montarPainel(graph: GraphClient, accountId: string, rangeType: string): Promise<DadosResponse> {
  const acc = await graph.get<MetaAccount>(accountId, { fields: "id,name,currency,timezone_name,account_status" });
  const timezone = acc.timezone_name || "America/Sao_Paulo";
  const currency = acc.currency || "BRL";
  const { atual, anterior } = periodos(timezone, rangeType);
  const range = (p: typeof atual) => JSON.stringify(p);
  const unified = { use_unified_attribution_setting: "true" };
  const F_CONTA = "spend,impressions,reach,inline_link_clicks,actions,action_values";
  const F_CAMP = "campaign_id,campaign_name,objective,spend,impressions,reach,inline_link_clicks,actions,action_values";

  const [
    contaAtualRows,
    contaAnteriorRows,
    campanhasEnt,
    campAtual,
    campAnterior,
    campDiario,
    adAtual,
    adAnterior,
    porHora,
  ] = await Promise.all([
    graph.list<InsightRow>(`${accountId}/insights`, { fields: F_CONTA, time_range: range(atual), ...unified }),
    graph.list<InsightRow>(`${accountId}/insights`, { fields: F_CONTA, time_range: range(anterior), ...unified }),
    graph.list<MetaCampaignEntity>(`${accountId}/campaigns`, {
      fields: "id,name,status,effective_status,objective,daily_budget,lifetime_budget",
    }),
    graph.list<InsightRow>(`${accountId}/insights`, { level: "campaign", fields: F_CAMP, time_range: range(atual), ...unified }),
    graph.list<InsightRow>(`${accountId}/insights`, { level: "campaign", fields: F_CAMP, time_range: range(anterior), ...unified }),
    graph.list<InsightRow>(`${accountId}/insights`, {
      level: "campaign",
      fields: "campaign_id,spend,impressions,inline_link_clicks,actions,date_start",
      time_range: range(atual),
      time_increment: 1,
      ...unified,
    }),
    graph.list<InsightRow>(`${accountId}/insights`, {
      level: "ad",
      fields: "ad_id,ad_name,campaign_id,campaign_name,spend,impressions,inline_link_clicks,actions,video_p100_watched_actions",
      time_range: range(atual),
      ...unified,
    }),
    graph.list<InsightRow>(`${accountId}/insights`, {
      level: "ad",
      fields: "ad_id,spend,impressions,inline_link_clicks",
      time_range: range(anterior),
      ...unified,
    }),
    // Hora no fuso da CONTA (advertiser), não no de quem viu o anúncio.
    graph.list<InsightRow>(`${accountId}/insights`, {
      fields: "spend,impressions,inline_link_clicks,actions,date_start",
      time_range: range(atual),
      time_increment: 1,
      breakdowns: "hourly_stats_aggregated_by_advertiser_time_zone",
      ...unified,
    }),
  ]);

  const campAtualMap = new Map(campAtual.map((r) => [r.campaign_id!, r]));
  const campAnteriorMap = new Map(campAnterior.map((r) => [r.campaign_id!, r]));

  // Conjuntos e anúncios por campanha, via /{id_da_campanha}/adsets e /ads:
  // só das campanhas ligadas ou que gastaram em algum dos dois períodos.
  const relevantes = campanhasEnt.filter(
    (c) => c.effective_status === "ACTIVE" || num(campAtualMap.get(c.id)?.spend) > 0 || num(campAnteriorMap.get(c.id)?.spend) > 0,
  );
  const conjuntosPorCampanha = new Map<string, MetaAdsetEntity[]>();
  const anunciosPorCampanha = new Map<string, MetaAdEntity[]>();
  await mapLimit(relevantes, 4, async (c) => {
    const [conjuntos, anuncios] = await Promise.all([
      graph.list<MetaAdsetEntity>(`${c.id}/adsets`, {
        fields: "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,learning_stage_info,optimization_goal,promoted_object,destination_type",
      }),
      graph.list<MetaAdEntity>(`${c.id}/ads`, {
        fields: "id,name,campaign_id,adset_id,status,effective_status,creative{id,name,thumbnail_url,image_url,title,object_type}",
      }),
    ]);
    conjuntosPorCampanha.set(c.id, conjuntos);
    anunciosPorCampanha.set(c.id, anuncios);
  });

  // Tipo de resultado de cada campanha (pelo que os conjuntos otimizam).
  const tipoPorCampanha = new Map<string, TipoResultado | null>();
  for (const c of campanhasEnt) tipoPorCampanha.set(c.id, tipoDaCampanha(c.objective, conjuntosPorCampanha.get(c.id)));
  for (const r of [...campAtual, ...campAnterior]) {
    if (r.campaign_id && !tipoPorCampanha.has(r.campaign_id)) tipoPorCampanha.set(r.campaign_id, tipoPorObjetivo(r.objective));
  }
  const tipoDe = (campaignId: string | undefined) => (campaignId ? (tipoPorCampanha.get(campaignId) ?? null) : null);
  const resultadosDe = (r: InsightRow | undefined, tipo: TipoResultado | null) => (r && tipo ? contar(r.actions, tipo).valor : 0);

  // ---------- totais: o tipo principal é o que mais recebeu dinheiro
  const somaPorTipo = (rows: InsightRow[]) => {
    const out = new Map<TipoResultado, { results: number; spend: number }>();
    for (const r of rows) {
      const tipo = tipoDe(r.campaign_id);
      if (!tipo) continue;
      const acc2 = out.get(tipo) ?? { results: 0, spend: 0 };
      acc2.results += resultadosDe(r, tipo);
      acc2.spend += num(r.spend);
      out.set(tipo, acc2);
    }
    return out;
  };
  const porTipoAtual = somaPorTipo(campAtual);
  const porTipoAnterior = somaPorTipo(campAnterior);
  const tipoPrincipal = [...porTipoAtual.entries()].sort((a, b) => b[1].spend - a[1].spend)[0]?.[0]
    ?? [...porTipoAnterior.entries()].sort((a, b) => b[1].spend - a[1].spend)[0]?.[0]
    ?? null;

  const contaAtual = contaAtualRows[0];
  const contaAnterior = contaAnteriorRows[0];
  const tAtual = totaisDe(contaAtual);
  const tAnterior = totaisDe(contaAnterior);
  const mAtual = metricas(tAtual);
  const mAnterior = metricas(tAnterior);

  const principalAtual = tipoPrincipal ? (porTipoAtual.get(tipoPrincipal) ?? { results: 0, spend: 0 }) : { results: 0, spend: 0 };
  const principalAnterior = tipoPrincipal ? (porTipoAnterior.get(tipoPrincipal) ?? { results: 0, spend: 0 }) : { results: 0, spend: 0 };
  const cprAtual = custoPor(principalAtual.spend, principalAtual.results);
  const cprAnterior = custoPor(principalAnterior.spend, principalAnterior.results);

  // Receita com o MESMO nome de compra que foi contado (nunca o maior dos três).
  const receita = (r: InsightRow | undefined) => valorDaConversao(r?.action_values, contar(r?.actions, "compra").nome);
  const receitaAtual = receita(contaAtual);
  const receitaAnterior = receita(contaAnterior);
  const roasAtual = tAtual.gasto > 0 ? receitaAtual / tAtual.gasto : 0;
  const roasAnterior = tAnterior.gasto > 0 ? receitaAnterior / tAnterior.gasto : 0;

  const outros = [...porTipoAtual.entries()]
    .filter(([tipo]) => tipo !== tipoPrincipal)
    .map(([tipo, v]) => ({ tipo, label: NOME_RESULTADO[tipo].varios, results: v.results, spend: v.spend }));

  // ---------- série diária: todos os dias do período, inclusive os sem gasto
  const porDia = new Map<string, { spend: number; imp: number; clk: number; res: number }>();
  for (const dia of listaDeDias(atual)) porDia.set(dia, { spend: 0, imp: 0, clk: 0, res: 0 });
  const diarioPorCampanha = new Map<string, InsightRow[]>();
  for (const r of campDiario) {
    const d = porDia.get(r.date_start ?? "");
    if (d) {
      d.spend += num(r.spend);
      d.imp += num(r.impressions);
      d.clk += num(r.inline_link_clicks);
      if (tipoDe(r.campaign_id) === tipoPrincipal) d.res += resultadosDe(r, tipoPrincipal);
    }
    const lista = diarioPorCampanha.get(r.campaign_id ?? "") ?? [];
    lista.push(r);
    diarioPorCampanha.set(r.campaign_id ?? "", lista);
  }
  const ponto = (date: string, v: { spend: number; imp: number; clk: number; res: number }): DailyPoint => ({
    date,
    label: `${date.slice(8, 10)}/${date.slice(5, 7)}`,
    spend: v.spend,
    results: v.res,
    cpr: custoPor(v.spend, v.res),
    ctr: metricas({ gasto: v.spend, impressoes: v.imp, cliques: v.clk }).ctr,
    impressions: v.imp,
    linkClicks: v.clk,
  });
  const serieDiaria = [...porDia.entries()].map(([date, v]) => ponto(date, v));

  // ---------- funil: só campanhas do tipo principal (misturar alcance/perfil distorce as taxas)
  const funilDe = (rows: InsightRow[]) => {
    const base = rows.filter((r) => tipoDe(r.campaign_id) === tipoPrincipal);
    const soma = (f: (r: InsightRow) => number) => base.reduce((s, r) => s + f(r), 0);
    return {
      imp: soma((r) => num(r.impressions)),
      clk: soma((r) => num(r.inline_link_clicks)),
      visita: soma((r) => contar(r.actions, "visita").valor),
      checkout: soma((r) => contar(r.actions, "checkout").valor),
      res: soma((r) => resultadosDe(r, tipoPrincipal)),
    };
  };
  const fA = funilDe(campAtual);
  const fB = funilDe(campAnterior);
  type Etapa = { nome: string; a: number; b: number };
  const etapasBrutas: Etapa[] = [
    { nome: "Impressões", a: fA.imp, b: fB.imp },
    { nome: "Cliques no link", a: fA.clk, b: fB.clk },
  ];
  if (tipoPrincipal !== "conversa") etapasBrutas.push({ nome: "Visitas à página", a: fA.visita, b: fB.visita });
  if (tipoPrincipal === "compra") etapasBrutas.push({ nome: "Checkouts", a: fA.checkout, b: fB.checkout });
  etapasBrutas.push({ nome: tipoPrincipal ? capitalize(rotulo(tipoPrincipal)) : "Resultados", a: fA.res, b: fB.res });
  const etapas: FunnelStep[] = etapasBrutas.map((e, i) => ({
    nome: e.nome,
    valor: e.a,
    pctAnterior: i === 0 ? 100 : taxa(e.a, etapasBrutas[i - 1].a),
    pctTopo: taxa(e.a, fA.imp),
    pctPeriodoAnterior: i === 0 ? null : etapasBrutas[i - 1].b > 0 ? taxa(e.b, etapasBrutas[i - 1].b) : null,
  }));
  const gargalo = acharGargalo(etapas, fA.clk);

  // ---------- campanhas (entidade + as que só aparecem no insights, já excluídas)
  const idsEntidade = new Set(campanhasEnt.map((c) => c.id));
  const entregaram = new Set(adAtual.filter((r) => num(r.impressions) > 0).map((r) => r.ad_id));
  const soNoInsights = campAtual.filter((r) => r.campaign_id && !idsEntidade.has(r.campaign_id) && num(r.spend) > 0);

  const campanhas: MetaCampaign[] = [
    ...campanhasEnt.map((c) => ({ id: c.id, name: c.name, objective: c.objective, status: c.status, effective_status: c.effective_status, entidade: c as MetaCampaignEntity | null })),
    ...soNoInsights.map((r) => ({ id: r.campaign_id!, name: r.campaign_name ?? r.campaign_id!, objective: r.objective ?? "", status: "DELETED", effective_status: "DELETED", entidade: null })),
  ].map((c) => {
    const ins = campAtualMap.get(c.id);
    const t = totaisDe(ins);
    const m = metricas(t);
    const tipo = tipoDe(c.id);
    const results = resultadosDe(ins, tipo);
    const conjuntos = conjuntosPorCampanha.get(c.id) ?? [];
    const anuncios = anunciosPorCampanha.get(c.id) ?? [];
    const sit = SITUACAO[c.entidade ? situacao(c.effective_status, t.impressoes) : "encerrada"];
    const budget = c.entidade ? orcamento(c.entidade, conjuntos, currency) : null;

    const serie = new Map(listaDeDias(atual).map((d) => [d, { spend: 0, imp: 0, clk: 0, res: 0 }]));
    for (const r of diarioPorCampanha.get(c.id) ?? []) {
      const d = serie.get(r.date_start ?? "");
      if (!d) continue;
      d.spend += num(r.spend);
      d.imp += num(r.impressions);
      d.clk += num(r.inline_link_clicks);
      d.res += resultadosDe(r, tipo);
    }

    const adsets: AdsetDetail[] = conjuntos.map((s) => ({
      id: s.id,
      name: s.name,
      status: s.status,
      effective_status: s.effective_status,
      daily_budget: deCentavos(s.daily_budget, currency),
      lifetime_budget: deCentavos(s.lifetime_budget, currency),
      learning_stage: s.learning_stage_info?.status ?? "",
      optimization_goal: s.optimization_goal ?? "",
      resultType: tipoDoConjunto(s),
    }));
    // Só anúncios ligados ou que entregaram no período: pausado antigo só pesa no celular.
    const ads: AdDetail[] = anuncios.filter((a) => a.effective_status === "ACTIVE" || entregaram.has(a.id)).map((a) => ({
      id: a.id,
      name: a.name,
      adset_id: a.adset_id,
      status: a.status,
      effective_status: a.effective_status,
      creative: a.creative
        ? {
            id: a.creative.id,
            name: a.creative.name ?? "",
            thumbnail_url: a.creative.thumbnail_url ?? a.creative.image_url ?? "",
            title: a.creative.title ?? "",
            body: "",
          }
        : null,
    }));

    return {
      id: c.id,
      name: c.name,
      objective: c.objective,
      status: c.status,
      effective_status: c.effective_status,
      situacao: sit.situacao,
      situacaoLabel: sit.label,
      situacaoColor: sit.color,
      spend: t.gasto,
      results,
      cpr: custoPor(t.gasto, results),
      ctr: m.ctr,
      cpm: m.cpm,
      impressions: t.impressoes,
      frequency: m.frequencia,
      daily_budget: budget?.periodo === "dia" ? budget.valor : null,
      budgetType: budget ? (budget.onde === "campanha" ? "Campanha (CBO)" : "Conjunto (ABO)") : "",
      budget,
      resultType: tipo,
      resultLabel: rotulo(tipo),
      learning: aprendizado(conjuntos),
      activeAdsets: conjuntos.filter((s) => s.effective_status === "ACTIVE").length,
      serieDiaria: [...serie.entries()].map(([date, v]) => ponto(date, v)),
      adsets,
      ads,
    };
  });

  const ordemSituacao = (c: MetaCampaign) => (c.situacao === "ATIVA" ? 0 : c.situacao === "SEM_ENTREGA" ? 1 : 2);
  campanhas.sort((a, b) => ordemSituacao(a) - ordemSituacao(b) || b.spend - a.spend);

  // ---------- criativos: um por anúncio que entregou no período
  const anuncioPorId = new Map<string, MetaAdEntity>();
  for (const lista of anunciosPorCampanha.values()) for (const a of lista) anuncioPorId.set(a.id, a);
  const adAnteriorMap = new Map(adAnterior.map((r) => [r.ad_id!, r]));

  const criativos: MetaCreative[] = adAtual
    .filter((r) => num(r.impressions) > 0)
    .map((r) => {
      const t = totaisDe(r);
      const m = metricas(t);
      const tipo = tipoDe(r.campaign_id);
      const results = resultadosDe(r, tipo);
      const video3s = contar(r.actions, "video3s").valor;
      const videoP100 = campoDeVideo(r.video_p100_watched_actions);
      const ent = anuncioPorId.get(r.ad_id ?? "");
      return {
        id: r.ad_id ?? "",
        name: r.ad_name ?? "",
        campaign_id: r.campaign_id ?? "",
        campaign_name: r.campaign_name ?? "",
        spend: t.gasto,
        results,
        cpr: custoPor(t.gasto, results),
        ctr: m.ctr,
        cpm: m.cpm,
        impressions: t.impressoes,
        resultLabel: rotulo(tipo),
        isVideo: ent?.creative?.object_type === "VIDEO" || video3s > 0,
        video3s,
        videoP100,
        hookRate: taxa(video3s, t.impressoes),
        retentionRate: taxa(videoP100, t.impressoes),
        cansado: estaCansado(t, totaisDe(adAnteriorMap.get(r.ad_id ?? ""))),
        thumbnail: ent?.creative?.image_url || ent?.creative?.thumbnail_url || null,
        title: ent?.creative?.title ?? "",
        // O texto do anúncio não aparece em nenhuma tela; mandar só pesa no celular.
        body: "",
      };
    })
    .sort((a, b) => b.spend - a.spend);

  // ---------- horário: dia da semana × hora, ambos no fuso da conta
  const heatmap: HeatmapCell[][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => ({ spend: 0, clicks: 0, leads: 0, count: 0 })),
  );
  for (const r of porHora) {
    const faixa = r.hourly_stats_aggregated_by_advertiser_time_zone;
    if (!r.date_start || !faixa) continue;
    const hora = Number(faixa.slice(0, 2));
    const cell = heatmap[diaDaSemana(r.date_start)]?.[hora];
    if (!cell) continue;
    cell.spend += num(r.spend);
    cell.clicks += num(r.inline_link_clicks);
    cell.leads += tipoPrincipal ? contar(r.actions, tipoPrincipal).valor : 0;
    cell.count += 1;
  }

  const avisos = montarAvisos({
    conta: acc,
    tipoPrincipal,
    cprAtual,
    cprAnterior,
    frequencia: mAtual.frequencia,
    etapas,
    cliques: fA.clk,
    campanhas,
    criativos,
    conjuntosPorCampanha,
    anunciosPorCampanha,
    porTipoAtual,
    dias: listaDeDias(atual).length,
  });

  return {
    conta: { id: acc.id, name: acc.name, currency, timezone },
    periodo: { range: rangeType, atual, anterior },
    totais: {
      spend: tAtual.gasto,
      results: principalAtual.results,
      primaryType: rotulo(tipoPrincipal),
      resultType: tipoPrincipal,
      spendResultType: principalAtual.spend,
      cpr: cprAtual,
      roas: roasAtual,
      impressions: tAtual.impressoes,
      clicks: tAtual.cliques,
      reach: tAtual.alcance,
      frequency: mAtual.frequencia,
      ctr: mAtual.ctr,
      cpm: mAtual.cpm,
      purchases: porTipoAtual.get("compra")?.results ?? 0,
      leads: porTipoAtual.get("lead")?.results ?? 0,
      messages: porTipoAtual.get("conversa")?.results ?? 0,
      revenue: receitaAtual,
      outros,
    },
    variacoes: {
      spend: variacao(tAtual.gasto, tAnterior.gasto),
      results: variacao(principalAtual.results, principalAnterior.results),
      cpr: cprAtual > 0 && cprAnterior > 0 ? variacao(cprAtual, cprAnterior) : null,
      roas: roasAtual > 0 && roasAnterior > 0 ? variacao(roasAtual, roasAnterior) : null,
      ctr: variacao(mAtual.ctr, mAnterior.ctr),
      cpm: variacao(mAtual.cpm, mAnterior.cpm),
      impressions: variacao(tAtual.impressoes, tAnterior.impressoes),
      clicks: variacao(tAtual.cliques, tAnterior.cliques),
    },
    serieDiaria,
    funil: {
      base: tipoPrincipal ? `Só campanhas de ${rotulo(tipoPrincipal)}` : "Todas as campanhas",
      etapas,
      gargalo,
    },
    campanhas,
    criativos,
    heatmap,
    avisos,
    timestamp: new Date().toISOString(),
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function orcamento(c: MetaCampaignEntity, conjuntos: MetaAdsetEntity[], moeda: string): MetaCampaign["budget"] {
  const diaCampanha = deCentavos(c.daily_budget, moeda);
  if (diaCampanha) return { valor: diaCampanha, periodo: "dia", onde: "campanha" };
  const totalCampanha = deCentavos(c.lifetime_budget, moeda);
  if (totalCampanha) return { valor: totalCampanha, periodo: "total", onde: "campanha" };
  const ligados = conjuntos.filter((s) => s.effective_status === "ACTIVE");
  const dia = ligados.reduce((s, x) => s + (deCentavos(x.daily_budget, moeda) ?? 0), 0);
  if (dia) return { valor: dia, periodo: "dia", onde: "conjuntos" };
  const total = ligados.reduce((s, x) => s + (deCentavos(x.lifetime_budget, moeda) ?? 0), 0);
  if (total) return { valor: total, periodo: "total", onde: "conjuntos" };
  return null;
}

/** Gargalo: primeiro a regra da página (<60% dos cliques viram visita); senão, a etapa que mais piorou. */
function acharGargalo(etapas: FunnelStep[], cliques: number): { etapa: string; explicacao: string } {
  const visita = etapas.find((e) => e.nome === "Visitas à página");
  if (visita && cliques >= 100 && visita.pctAnterior < LIMITES.cliqueParaVisita) {
    return {
      etapa: "Clique → Visita",
      explicacao: `Só ${visita.pctAnterior.toFixed(1)}% de quem clica chega a ver a página. Abaixo de ${LIMITES.cliqueParaVisita}% é problema de página (lenta, fora do ar ou redirecionando), não de anúncio.`,
    };
  }
  let pior: { etapa: string; queda: number; atual: number; antes: number } | null = null;
  for (let i = 1; i < etapas.length; i++) {
    const e = etapas[i];
    if (e.pctPeriodoAnterior == null || e.pctPeriodoAnterior === 0) continue;
    const queda = variacao(e.pctAnterior, e.pctPeriodoAnterior) ?? 0;
    if (queda < -10 && (!pior || queda < pior.queda)) {
      pior = { etapa: `${etapas[i - 1].nome} → ${e.nome}`, queda, atual: e.pctAnterior, antes: e.pctPeriodoAnterior };
    }
  }
  if (pior) {
    return {
      etapa: pior.etapa,
      explicacao: `É a etapa que mais piorou: passavam ${pior.antes.toFixed(1)}% e agora passam ${pior.atual.toFixed(1)}% (${pior.queda.toFixed(0)}% contra o período anterior).`,
    };
  }
  return { etapa: "Nenhum", explicacao: "Nenhuma etapa piorou mais de 10% contra o período anterior." };
}

// ---------------------------------------------------------------- diagnóstico

function montarAvisos(ctx: {
  conta: MetaAccount;
  tipoPrincipal: TipoResultado | null;
  cprAtual: number;
  cprAnterior: number;
  frequencia: number;
  etapas: FunnelStep[];
  cliques: number;
  campanhas: MetaCampaign[];
  criativos: MetaCreative[];
  conjuntosPorCampanha: Map<string, MetaAdsetEntity[]>;
  anunciosPorCampanha: Map<string, MetaAdEntity[]>;
  porTipoAtual: Map<TipoResultado, { results: number; spend: number }>;
  dias: number;
}): Aviso[] {
  const avisos: Aviso[] = [];
  const umDe = (t: TipoResultado | null) => (t ? NOME_RESULTADO[t].um : "resultado");
  const brl = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const lista = (nomes: string[], max = 3) =>
    nomes.slice(0, max).map((n) => `"${n}"`).join(", ") + (nomes.length > max ? ` e mais ${nomes.length - max}` : "");

  // Conta com problema de pagamento ou bloqueio: nada entrega até resolver.
  const statusConta = ctx.conta.account_status;
  if (statusConta && statusConta !== 1 && statusConta !== 201) {
    avisos.push({
      tipo: "alerta",
      titulo: `Conta ${STATUS_CONTA[statusConta] ?? `com status ${statusConta}`}`,
      descricao: "Enquanto a conta estiver assim, a Meta não entrega nenhum anúncio dela.",
      acao: "Abra Configurações de pagamento / Qualidade da conta no Gerenciador e resolva a pendência.",
    });
  }

  // Ligada e sem entrega: com as causas prováveis tiradas da entidade.
  for (const c of ctx.campanhas.filter((x) => x.situacao === "SEM_ENTREGA").slice(0, 5)) {
    const conjuntos = ctx.conjuntosPorCampanha.get(c.id) ?? [];
    const ligados = conjuntos.filter((s) => s.effective_status === "ACTIVE");
    const idsLigados = new Set(ligados.map((s) => s.id));
    const anuncios = (ctx.anunciosPorCampanha.get(c.id) ?? []).filter((a) => idsLigados.has(a.adset_id));
    const anunciosLigados = anuncios.filter((a) => a.effective_status === "ACTIVE");
    const reprovados = anuncios.filter((a) => a.effective_status === "DISAPPROVED" || a.effective_status === "WITH_ISSUES");
    const causas: string[] = [];
    if (ligados.length === 0) causas.push("nenhum conjunto está ligado (todos pausados ou encerrados)");
    else if (anunciosLigados.length === 0) causas.push("os conjuntos ligados não têm nenhum anúncio ligado e aprovado");
    if (reprovados.length) causas.push(`${reprovados.length} anúncio(s) reprovado(s) ou com problema`);
    if (statusConta && statusConta !== 1) causas.push("a conta tem pendência de pagamento ou bloqueio");
    const genericas = ["orçamento ou lance baixo demais para o público", "público pequeno demais ou restrito", "data de início no futuro ou data de fim já passada"];
    for (const g of genericas) if (causas.length < 3) causas.push(g);
    avisos.push({
      tipo: "alerta",
      titulo: `Ligada e sem entrega: "${c.name}"`,
      descricao: `Está ligada na Meta, mas não teve nenhuma impressão no período. Causas mais prováveis: ${causas.slice(0, 3).join("; ")}.`,
      acao: "Confira, nessa ordem, os conjuntos e anúncios ligados, o orçamento e o público no Gerenciador.",
    });
  }

  // Menos de 60% dos cliques virando visita = problema de página.
  const visita = ctx.etapas.find((e) => e.nome === "Visitas à página");
  if (visita && ctx.cliques >= 100 && visita.pctAnterior < LIMITES.cliqueParaVisita) {
    avisos.push({
      tipo: "alerta",
      titulo: `Só ${visita.pctAnterior.toFixed(0)}% dos cliques viram visita`,
      descricao: "Abaixo de 60% o problema é a página, não o anúncio: as pessoas clicam e desistem antes de ela abrir.",
      acao: "Teste a velocidade da página no celular, confira se o link não redireciona várias vezes e se o pixel dispara ao abrir.",
    });
  }

  // Sangrando: ligada, gastou mais que 2× o custo médio e não trouxe resultado.
  for (const c of ctx.campanhas) {
    if (c.situacao !== "ATIVA" || !c.resultType || c.results > 0) continue;
    const media = ctx.porTipoAtual.get(c.resultType);
    const custoMedio = media && media.results > 0 ? media.spend / media.results : 0;
    if (custoMedio > 0 && c.spend > LIMITES.sangria * custoMedio) {
      avisos.push({
        tipo: "alerta",
        titulo: `Sangrando: "${c.name}"`,
        descricao: `Gastou R$ ${brl(c.spend)}, mais que o dobro do custo médio de R$ ${brl(custoMedio)} por ${umDe(c.resultType)}, e trouxe 0 ${rotulo(c.resultType)}.`,
        acao: "Reveja público e criativo, ou tire verba dela para uma campanha que está trazendo resultado.",
      });
    }
  }

  // Frequência acima de 3: o mesmo público vendo demais.
  if (ctx.frequencia > LIMITES.frequencia) {
    const altas = ctx.campanhas.filter((c) => c.situacao === "ATIVA" && c.frequency > LIMITES.frequencia).map((c) => c.name);
    avisos.push({
      tipo: "atencao",
      titulo: `Público saturando: cada pessoa viu ${ctx.frequencia.toFixed(1)} vezes em ${ctx.dias} dias`,
      descricao: `Acima de ${LIMITES.frequencia} o anúncio começa a cansar quem já viu.${altas.length ? ` Mais altas: ${lista(altas)}.` : ""}`,
      acao: "Renove os criativos ou amplie o público. Mais verba no mesmo público só repete o anúncio para as mesmas pessoas.",
    });
  }

  // Custo por resultado subindo.
  const dCpr = ctx.cprAtual > 0 && ctx.cprAnterior > 0 ? variacao(ctx.cprAtual, ctx.cprAnterior) : null;
  if (dCpr != null && dCpr > LIMITES.custoSubiu) {
    avisos.push({
      tipo: "atencao",
      titulo: `Custo por ${umDe(ctx.tipoPrincipal)} subiu ${dCpr.toFixed(0)}%`,
      descricao: `Passou de R$ ${brl(ctx.cprAnterior)} para R$ ${brl(ctx.cprAtual)} contra o período anterior.`,
      acao: "Veja no Funil qual etapa piorou e, em Criativos, quais anúncios estão cansados.",
    });
  }

  // Anúncios cansados pela regra: CTR -20% e CPM +10%.
  const cansados = ctx.criativos.filter((c) => c.cansado);
  if (cansados.length) {
    avisos.push({
      tipo: "atencao",
      titulo: `${cansados.length} anúncio(s) cansado(s)`,
      descricao: `A taxa de clique caiu mais de 20% e o custo por mil exibições subiu mais de 10% contra o período anterior: ${lista(cansados.map((c) => c.name))}.`,
      acao: "Suba variações novas desses criativos. Aumentar verba em anúncio cansado só encarece o resultado.",
    });
  }

  // Aprendizado limitado.
  const limitadas = ctx.campanhas.filter((c) => c.situacao === "ATIVA" && c.learning === "limitado");
  if (limitadas.length) {
    avisos.push({
      tipo: "atencao",
      titulo: `Aprendizado limitado em ${limitadas.length} campanha(s)`,
      descricao: `A Meta não está conseguindo resultados suficientes para otimizar: ${lista(limitadas.map((c) => c.name))}.`,
      acao: "Junte conjuntos parecidos ou dê mais orçamento a menos conjuntos, para cada um juntar resultados mais rápido.",
    });
  }

  // Puxando: custo abaixo da média da conta.
  if (ctx.tipoPrincipal && ctx.cprAtual > 0) {
    const puxando = ctx.campanhas
      .filter((c) => c.situacao === "ATIVA" && c.resultType === ctx.tipoPrincipal && c.results > 0 && c.cpr < ctx.cprAtual)
      .sort((a, b) => a.cpr - b.cpr);
    if (puxando.length) {
      avisos.push({
        tipo: "sucesso",
        titulo: `Puxando: ${puxando.length} campanha(s) abaixo do custo médio`,
        descricao: `${lista(puxando.map((c) => `${c.name} (R$ ${brl(c.cpr)})`))}. A média da conta é R$ ${brl(ctx.cprAtual)} por ${umDe(ctx.tipoPrincipal)}.`,
        acao: "São as candidatas a receber mais verba. Suba aos poucos e confira o custo depois de alguns dias.",
      });
    }
  }

  if (!ctx.tipoPrincipal) {
    avisos.push({
      tipo: "info",
      titulo: "Nenhuma campanha de compra, lead ou conversa no período",
      descricao: "As campanhas com gasto são de alcance, tráfego ou engajamento: não existe resultado de compra, lead ou conversa para contar.",
      acao: "Olhe CTR, CPM e alcance em Campanhas e Criativos.",
    });
  }

  const ordem = { alerta: 0, atencao: 1, sucesso: 2, info: 3 } as const;
  return avisos.sort((a, b) => ordem[a.tipo] - ordem[b.tipo]);
}
