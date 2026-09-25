// Regras de negócio do painel da Meta. Funções puras, sem rede: dá pra testar
// cada regra com números reais sem chamar a Graph API.
// Rodar os testes: node --test scripts/meta-regras.test.mjs

export type MetaAction = { action_type: string; value: string };

export type TipoResultado = "compra" | "lead" | "conversa";

// A Meta reporta a mesma conversão com vários nomes ao mesmo tempo. Conta-se só o
// primeiro nome presente, nesta ordem. Somar a lista faz uma venda virar três.
export const PRIORIDADE = {
  compra: ["purchase", "offsite_conversion.fb_pixel_purchase", "omni_purchase"],
  lead: ["lead", "offsite_conversion.fb_pixel_lead", "onsite_conversion.lead_grouped", "leadgen_grouped"],
  conversa: ["onsite_conversion.messaging_conversation_started_7d", "onsite_conversion.total_messaging_connection"],
  visita: ["landing_page_view", "omni_landing_page_view"],
  checkout: ["initiate_checkout", "offsite_conversion.fb_pixel_initiate_checkout", "omni_initiated_checkout"],
  video3s: ["video_view"],
} as const;

export type Categoria = keyof typeof PRIORIDADE;

export const NOME_RESULTADO: Record<TipoResultado, { um: string; varios: string }> = {
  compra: { um: "compra", varios: "compras" },
  lead: { um: "lead", varios: "leads" },
  conversa: { um: "conversa", varios: "conversas" },
};

/** Primeiro nome da lista de prioridade presente em `acoes`. Nunca soma nomes. */
export function contar(acoes: MetaAction[] | undefined, categoria: Categoria): { valor: number; nome: string | null } {
  for (const nome of PRIORIDADE[categoria]) {
    const achado = (acoes ?? []).find((a) => a.action_type === nome);
    if (achado) return { valor: Number(achado.value) || 0, nome };
  }
  return { valor: 0, nome: null };
}

/** Valor em dinheiro da conversão, sempre com o MESMO nome usado na contagem. */
export function valorDaConversao(valores: MetaAction[] | undefined, nome: string | null): number {
  if (!nome) return 0;
  const achado = (valores ?? []).find((a) => a.action_type === nome);
  return achado ? Number(achado.value) || 0 : 0;
}

/** Campos de vídeo vêm como lista [{ action_type: "video_view", value }]. */
export function campoDeVideo(lista: MetaAction[] | undefined): number {
  const achado = (lista ?? []).find((a) => a.action_type === "video_view");
  return achado ? Number(achado.value) || 0 : 0;
}

// ---------------------------------------------------------------- datas

/** Data civil (AAAA-MM-DD) no fuso da CONTA, não no do servidor (que roda em UTC). */
export function dataNoFuso(fuso: string, instante: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: fuso,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
}

/** Soma dias a uma data civil. Aritmética de calendário, sem relógio envolvido. */
export function somarDias(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export type Intervalo = { since: string; until: string };

function blocoAnterior(atual: Intervalo): Intervalo {
  const dias = listaDeDias(atual).length;
  const until = somarDias(atual.since, -1);
  return { since: somarDias(until, -(dias - 1)), until };
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/**
 * Período atual e o anterior de mesmo tamanho, contados no dia da conta.
 * "Últimos N dias" são N dias completos até ontem, como no Gerenciador.
 */
export function periodos(fuso: string, range: string, instante: Date = new Date()): {
  hoje: string;
  atual: Intervalo;
  anterior: Intervalo;
} {
  const hoje = dataNoFuso(fuso, instante);
  const ontem = somarDias(hoje, -1);
  const ultimos = (n: number): Intervalo => ({ since: somarDias(ontem, -(n - 1)), until: ontem });
  const [ano, mes] = hoje.split("-").map(Number);

  let atual: Intervalo;
  let anterior: Intervalo;
  switch (range) {
    case "today":
      atual = { since: hoje, until: hoje };
      anterior = { since: ontem, until: ontem };
      break;
    case "yesterday":
      atual = { since: ontem, until: ontem };
      anterior = blocoAnterior(atual);
      break;
    case "last_7d":
      atual = ultimos(7);
      anterior = blocoAnterior(atual);
      break;
    case "last_14d":
      atual = ultimos(14);
      anterior = blocoAnterior(atual);
      break;
    case "this_month": {
      atual = { since: `${hoje.slice(0, 7)}-01`, until: hoje };
      const mesAnt = mes === 1 ? 12 : mes - 1;
      const anoAnt = mes === 1 ? ano - 1 : ano;
      const dia = Math.min(Number(hoje.slice(8, 10)), ultimoDiaDoMes(anoAnt, mesAnt));
      const p = `${anoAnt}-${String(mesAnt).padStart(2, "0")}`;
      anterior = { since: `${p}-01`, until: `${p}-${String(dia).padStart(2, "0")}` };
      break;
    }
    case "last_month": {
      const mesAnt = mes === 1 ? 12 : mes - 1;
      const anoAnt = mes === 1 ? ano - 1 : ano;
      const p = `${anoAnt}-${String(mesAnt).padStart(2, "0")}`;
      atual = { since: `${p}-01`, until: `${p}-${ultimoDiaDoMes(anoAnt, mesAnt)}` };
      const mes2 = mesAnt === 1 ? 12 : mesAnt - 1;
      const ano2 = mesAnt === 1 ? anoAnt - 1 : anoAnt;
      const p2 = `${ano2}-${String(mes2).padStart(2, "0")}`;
      anterior = { since: `${p2}-01`, until: `${p2}-${ultimoDiaDoMes(ano2, mes2)}` };
      break;
    }
    case "last_30d":
    default:
      atual = ultimos(30);
      anterior = blocoAnterior(atual);
  }
  return { hoje, atual, anterior };
}

export function listaDeDias({ since, until }: Intervalo): string[] {
  const dias: string[] = [];
  for (let d = since; d <= until; d = somarDias(d, 1)) dias.push(d);
  return dias;
}

/** 0 = domingo. A data já é a do fuso da conta, então o dia da semana também é. */
export function diaDaSemana(ymd: string): number {
  return new Date(`${ymd}T12:00:00Z`).getUTCDay();
}

// ---------------------------------------------------------------- métricas

export type Totais = { gasto: number; impressoes: number; cliques: number; alcance?: number };

/** CTR, CPM, CPC e frequência sempre a partir dos totais. Nunca média de médias. */
export function metricas({ gasto, impressoes, cliques, alcance = 0 }: Totais) {
  return {
    ctr: impressoes > 0 ? (cliques / impressoes) * 100 : 0,
    cpm: impressoes > 0 ? (gasto / impressoes) * 1000 : 0,
    cpc: cliques > 0 ? gasto / cliques : 0,
    frequencia: alcance > 0 ? impressoes / alcance : 0,
  };
}

export function custoPor(gasto: number, resultados: number): number {
  return resultados > 0 ? gasto / resultados : 0;
}

/** Variação % contra o anterior. Sem base (anterior 0) a variação não existe: devolve null. */
export function variacao(atual: number, anterior: number): number | null {
  if (!Number.isFinite(atual) || !Number.isFinite(anterior) || anterior === 0) return null;
  return ((atual - anterior) / anterior) * 100;
}

export function taxa(parte: number, todo: number): number {
  return todo > 0 ? (parte / todo) * 100 : 0;
}

// ---------------------------------------------------------------- tipo de resultado

type ConjuntoParaTipo = {
  effective_status?: string;
  optimization_goal?: string;
  destination_type?: string;
  promoted_object?: { custom_event_type?: string };
};

const EVENTO_LEAD = new Set(["LEAD", "COMPLETE_REGISTRATION", "CONTACT", "SUBMIT_APPLICATION", "SCHEDULE"]);
const DESTINO_CONVERSA = /WHATSAPP|MESSENGER|INSTAGRAM_DIRECT|MESSAGING/;

/** O resultado segue o que o CONJUNTO otimiza, não o volume de cada ação. */
export function tipoDoConjunto(conjunto: ConjuntoParaTipo): TipoResultado | null {
  const meta = conjunto.optimization_goal;
  const evento = conjunto.promoted_object?.custom_event_type;
  const destino = conjunto.destination_type ?? "";
  if (meta === "CONVERSATIONS" || DESTINO_CONVERSA.test(destino)) return "conversa";
  if (meta === "LEAD_GENERATION" || meta === "QUALITY_LEAD") return "lead";
  if (meta === "OFFSITE_CONVERSIONS" || meta === "VALUE") {
    if (evento === "PURCHASE") return "compra";
    if (evento && EVENTO_LEAD.has(evento)) return "lead";
    return meta === "VALUE" ? "compra" : null;
  }
  return null;
}

export function tipoPorObjetivo(objetivo: string | undefined): TipoResultado | null {
  if (objetivo === "OUTCOME_SALES" || objetivo === "CONVERSIONS" || objetivo === "PRODUCT_CATALOG_SALES") return "compra";
  if (objetivo === "OUTCOME_LEADS" || objetivo === "LEAD_GENERATION") return "lead";
  if (objetivo === "MESSAGES") return "conversa";
  return null;
}

/**
 * Tipo da campanha = o tipo mais comum entre os conjuntos (os ligados primeiro).
 * Só cai no objetivo quando nenhum conjunto diz nada. Alcance, tráfego e
 * engajamento sem conversa não têm resultado de compra, lead ou conversa.
 */
export function tipoDaCampanha(objetivo: string | undefined, conjuntos: ConjuntoParaTipo[] = []): TipoResultado | null {
  const ligados = conjuntos.filter((c) => c.effective_status === "ACTIVE");
  const base = ligados.length ? ligados : conjuntos;
  const votos = new Map<TipoResultado, number>();
  let algumSemTipo = false;
  for (const c of base) {
    const t = tipoDoConjunto(c);
    if (t) votos.set(t, (votos.get(t) ?? 0) + 1);
    else if (c.optimization_goal) algumSemTipo = true;
  }
  const vencedor = [...votos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (vencedor) return vencedor;
  if (algumSemTipo) return null;
  return tipoPorObjetivo(objetivo);
}

// ---------------------------------------------------------------- entidade

const MOEDA_SEM_CENTAVOS = new Set(["JPY", "KRW", "CLP", "COP", "HUF", "ISK", "PYG", "TWD", "VND", "IDR"]);

/** Orçamentos vêm na menor unidade da moeda (centavos para BRL). */
export function deCentavos(valor: string | number | undefined | null, moeda: string): number | null {
  if (valor == null || valor === "" || Number(valor) === 0) return null;
  return MOEDA_SEM_CENTAVOS.has(moeda) ? Number(valor) : Number(valor) / 100;
}

export type Situacao = "ativa" | "sem_entrega" | "com_problema" | "em_analise" | "encerrada" | "pausada";

/** Status vem da entidade (/campaigns). Ligada e sem impressão no período = sem entrega. */
export function situacao(statusEfetivo: string | undefined, impressoes: number): Situacao {
  if (statusEfetivo === "ACTIVE") return impressoes > 0 ? "ativa" : "sem_entrega";
  if (statusEfetivo === "WITH_ISSUES" || statusEfetivo === "DISAPPROVED" || statusEfetivo === "PENDING_BILLING_INFO") return "com_problema";
  if (statusEfetivo === "IN_PROCESS" || statusEfetivo === "PENDING_REVIEW" || statusEfetivo === "PREAPPROVED") return "em_analise";
  if (statusEfetivo === "ARCHIVED" || statusEfetivo === "DELETED" || statusEfetivo == null) return "encerrada";
  return "pausada";
}

export type Aprendizado = "aprendendo" | "limitado" | "estavel" | null;

/** Fase de aprendizagem vem de learning_stage_info dos conjuntos ligados. */
export function aprendizado(conjuntos: { effective_status?: string; learning_stage_info?: { status?: string } }[]): Aprendizado {
  const status = conjuntos
    .filter((c) => c.effective_status === "ACTIVE")
    .map((c) => c.learning_stage_info?.status)
    .filter((s): s is string => Boolean(s));
  if (status.includes("FAIL")) return "limitado";
  if (status.includes("LEARNING")) return "aprendendo";
  if (status.length && status.every((s) => s === "SUCCESS")) return "estavel";
  return null;
}

// ---------------------------------------------------------------- cansaço

/** Cansado = CTR caiu mais de 20% E CPM subiu mais de 10%, com base mínima nos dois períodos. */
export function estaCansado(atual: Totais | undefined, anterior: Totais | undefined, minimoImpressoes = 1000): boolean {
  if (!atual || !anterior) return false;
  if (atual.impressoes < minimoImpressoes || anterior.impressoes < minimoImpressoes) return false;
  const dCtr = variacao(metricas(atual).ctr, metricas(anterior).ctr);
  const dCpm = variacao(metricas(atual).cpm, metricas(anterior).cpm);
  return dCtr != null && dCpm != null && dCtr < -20 && dCpm > 10;
}

// Limites usados no Diagnóstico. Um lugar só, com o motivo de cada um.
export const LIMITES = {
  /** Frequência acima disso no período = o mesmo público vendo o anúncio vezes demais. */
  frequencia: 3,
  /** Menos que isso dos cliques virando visita = problema de página, não de anúncio. */
  cliqueParaVisita: 60,
  /** Campanha "sangrando": gastou mais que N vezes o custo médio e não trouxe resultado. */
  sangria: 2,
  /** Custo por resultado subiu mais que isso (%) contra o período anterior. */
  custoSubiu: 20,
} as const;
