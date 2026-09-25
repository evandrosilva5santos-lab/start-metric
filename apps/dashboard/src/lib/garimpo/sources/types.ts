export type SourceId = "api_oficial" | "terceiro" | "scraper_proprio";

export type SearchParams = {
  niche: string;
  country: string;
  limit?: number;
  /** Só para o scraper próprio: páginas de ofertas vigiadas. */
  pageIds?: string[];
};

export type Ad = {
  adArchiveId: string;
  pageId: string;
  pageName: string | null;
  startedAt: string | null;
  isActive: boolean;
  /** Link de destino do anúncio, quando a fonte entrega. */
  link: string | null;
  /** Domínio exibido no anúncio (caption), quando a fonte entrega. */
  displayedDomain: string | null;
  mediaUrl: string | null;
  bodyText: string | null;
  cta: string | null;
  format: string | null;
  /** Hash perceptual (dHash) calculado a partir dos pixels; só o scraper próprio tem. */
  pixelHash?: string | null;
};

export type SourceStatus = "ok" | "blocked" | "error" | "not_configured" | "unavailable";

export type SourceResult = {
  ads: Ad[];
  status: SourceStatus;
  message?: string;
  costPerThousand?: number | null;
  /** Páginas lidas até o fim (permite marcar como inativos os anúncios que sumiram). */
  completedPageIds?: string[];
};

export interface AdSource {
  id: SourceId;
  search(params: SearchParams): Promise<SourceResult>;
}

export const SOURCE_LABELS: Record<SourceId, string> = {
  api_oficial: "API oficial",
  terceiro: "Terceiro (Apify)",
  scraper_proprio: "Scraper próprio",
};
