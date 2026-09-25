// Cliente mínimo da Graph API para o painel: segue a paginação até o fim e
// transforma qualquer erro da Meta em MetaGraphError (nunca em lista vazia).

const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";
const BASE_URL = `https://graph.facebook.com/${GRAPH_VERSION}`;
const TIMEOUT_MS = 20_000;
/** Teto de páginas por consulta: protege a cota se algo vier fora do normal. */
const MAX_PAGES = 30;

type GraphErrorBody = { code: number; error_subcode?: number; message: string; error_user_msg?: string };

export class MetaGraphError extends Error {
  readonly code: number;
  readonly subcode?: number;
  readonly userMessage?: string;
  readonly where: string;

  constructor(body: GraphErrorBody, where: string, token: string) {
    const scrub = (s?: string) => (s ? s.split(token).join("***") : s);
    super(scrub(body.message) ?? "Erro da Meta");
    this.code = body.code;
    this.subcode = body.error_subcode;
    this.userMessage = scrub(body.error_user_msg);
    this.where = where;
  }

  /** Erro 17 (limite da conta) e os irmãos de limite: 4, 32, 613 e 80000–80014. */
  get isRateLimit(): boolean {
    return [4, 17, 32, 613].includes(this.code) || (this.code >= 80000 && this.code <= 80014);
  }

  get isTokenInvalid(): boolean {
    return this.code === 190;
  }
}

export type GraphParams = Record<string, string | number | boolean | undefined>;

export function createGraphClient(token: string) {
  function url(path: string, params: GraphParams = {}): string {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
    qs.set("access_token", token);
    return `${BASE_URL}/${path}?${qs}`;
  }

  async function fetchJson<T>(fullUrl: string, where: string): Promise<T> {
    let res: Response;
    try {
      res = await fetch(fullUrl, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new MetaGraphError({ code: -1, message: `Sem resposta da Meta (${msg})` }, where, token);
    }
    const json = (await res.json().catch(() => ({}))) as T & { error?: GraphErrorBody };
    if (json.error) throw new MetaGraphError(json.error, where, token);
    if (!res.ok) throw new MetaGraphError({ code: res.status, message: `HTTP ${res.status}` }, where, token);
    return json;
  }

  return {
    /** Um objeto (conta, campanha...). */
    async get<T>(path: string, params?: GraphParams): Promise<T> {
      return fetchJson<T>(url(path, params), path);
    },

    /** Uma lista inteira: segue paging.next até acabar (ou até MAX_PAGES). */
    async list<T>(path: string, params?: GraphParams): Promise<T[]> {
      const rows: T[] = [];
      let next: string | undefined = url(path, { limit: 500, ...params });
      for (let page = 0; next && page < MAX_PAGES; page++) {
        const json: { data?: T[]; paging?: { next?: string } } = await fetchJson(next, path);
        rows.push(...(json.data ?? []));
        next = json.paging?.next;
      }
      return rows;
    },
  };
}

export type GraphClient = ReturnType<typeof createGraphClient>;

/** Roda `fn` em cada item com no máximo `limit` ao mesmo tempo. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}
