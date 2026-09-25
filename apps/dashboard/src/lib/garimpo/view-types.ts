import type { Cut, OfferSignals } from "./score";
import type { SourceId } from "./sources/types";

export type OfferStatus = "novo" | "em_analise" | "aprovado" | "descartado";

export type RunStatus = "running" | "ok" | "blocked" | "error" | "not_configured" | "unavailable";

export type RunView = {
  id: string;
  source: SourceId;
  niche: string | null;
  country: string | null;
  startedAt: string;
  finishedAt: string | null;
  adsRead: number | null;
  domainsFound: number | null;
  status: RunStatus;
  errorText: string | null;
  costPerThousand: number | null;
};

export type OfferCardView = {
  id: string;
  domain: string;
  status: OfferStatus;
  watch: boolean;
  score: number | null;
  signals: OfferSignals | null;
  divergent: boolean;
  passesCut: boolean;
  /** Repetição de criativo detectada só por texto/arquivo (sem hash de pixels). */
  weakHash: boolean;
  spark: number[];
  thumbs: string[];
  firstSeenAt: string;
  lastSeenAt: string;
};

export type GarimpoOverview = {
  offers: OfferCardView[];
  cut: Cut;
  latestRun: RunView | null;
  lastGoodRun: RunView | null;
  kpis: {
    newToday: number | null;
    passedCut: number | null;
    repeatedCreative: number | null;
    adsRead: number | null;
  };
  loadError: string | null;
};

export type OfferDetailView = {
  offer: {
    id: string;
    domain: string;
    status: OfferStatus;
    watch: boolean;
    score: number | null;
    firstSeenAt: string;
    lastSeenAt: string;
  };
  signals: OfferSignals;
  divergent: boolean;
  pages: Array<{ id: string; pageIdMeta: string; pageName: string | null; firstSeenAt: string; activeAds: number; totalAds: number }>;
  daily: Array<{ day: string; activeAds: number | null; pages: number | null }>;
  newPageDays: string[];
  chains: Array<{
    rawLink: string;
    displayedDomain: string | null;
    chain: string[];
    resolvedDomain: string | null;
    divergent: boolean;
    error: string | null;
    checkedAt: string;
  }>;
  creatives: Array<{
    key: string;
    mediaUrl: string | null;
    bodyText: string | null;
    pageCount: number;
    adCount: number;
    kind: "phash" | "fingerprint" | null;
    format: string | null;
  }>;
  latestRun: RunView | null;
  lastGoodRun: RunView | null;
};
