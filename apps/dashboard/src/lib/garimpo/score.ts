// Puro (sem imports) para rodar também em `node --test`.

/** Pesos do score. Aceleração e blindagem pesam mais que volume. */
export const SCORE_WEIGHTS = {
  volume: 0.15,
  longevity: 0.2,
  acceleration: 0.35,
  shielding: 0.3,
} as const;

export type ScoreWeights = { volume: number; longevity: number; acceleration: number; shielding: number };

export const NEW_WINDOW_DAYS = 14;

export type SignalAd = {
  pageKey: string;
  startedAt: string | null;
  isActive: boolean;
  creativeHash: string | null;
  format?: string | null;
};

export type OfferSignals = {
  activeAds: number;
  totalAds: number;
  pageCount: number;
  /** Dias do anúncio ativo mais antigo; null quando nenhum tem data de início. */
  oldestActiveDays: number | null;
  /** Anúncios iniciados nos últimos 14 dias; null quando não há datas. */
  new14d: number | null;
  /** Criativos (hash) vistos em 2+ páginas. */
  repeatedCreatives: number;
  /** Páginas que compartilham pelo menos um criativo com outra página. */
  pagesWithRepeatedCreative: number;
  maxPagesPerCreative: number;
  formats: string[];
};

export type ScoreParts = { volume: number; longevity: number; acceleration: number; shielding: number };

const DAY_MS = 86_400_000;

export function daysBetween(fromIso: string, now: Date): number | null {
  const t = Date.parse(fromIso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS));
}

export function computeSignals(ads: SignalAd[], now: Date = new Date()): OfferSignals {
  const pages = new Set<string>();
  const byHash = new Map<string, Set<string>>();
  const formats = new Set<string>();
  let activeAds = 0;
  let oldest: number | null = null;
  let withDate = 0;
  let recent = 0;

  for (const ad of ads) {
    pages.add(ad.pageKey);
    if (ad.format) formats.add(ad.format);
    if (ad.isActive) activeAds++;
    const age = ad.startedAt ? daysBetween(ad.startedAt, now) : null;
    if (age !== null) {
      withDate++;
      if (age < NEW_WINDOW_DAYS) recent++;
      if (ad.isActive && (oldest === null || age > oldest)) oldest = age;
    }
    if (ad.creativeHash) {
      const set = byHash.get(ad.creativeHash) ?? new Set<string>();
      set.add(ad.pageKey);
      byHash.set(ad.creativeHash, set);
    }
  }

  let repeatedCreatives = 0;
  let maxPagesPerCreative = 0;
  const sharedPages = new Set<string>();
  for (const set of byHash.values()) {
    maxPagesPerCreative = Math.max(maxPagesPerCreative, set.size);
    if (set.size >= 2) {
      repeatedCreatives++;
      for (const p of set) sharedPages.add(p);
    }
  }

  return {
    activeAds,
    totalAds: ads.length,
    pageCount: pages.size,
    oldestActiveDays: oldest,
    new14d: withDate > 0 ? recent : null,
    repeatedCreatives,
    pagesWithRepeatedCreative: sharedPages.size,
    maxPagesPerCreative,
    formats: [...formats].sort(),
  };
}

/** 0..1 que satura: dobrar um número grande muda pouco (marca grande não domina). */
function saturate(value: number, halfPoint: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return 1 - Math.pow(0.5, value / halfPoint);
}

export function scoreParts(s: OfferSignals): ScoreParts {
  return {
    volume: saturate(s.activeAds, 15),
    longevity: saturate(s.oldestActiveDays ?? 0, 30),
    acceleration: saturate(s.new14d ?? 0, 6),
    shielding: s.pagesWithRepeatedCreative >= 2 ? saturate(s.pagesWithRepeatedCreative - 1, 1.5) : 0,
  };
}

/** Score 0–100. Sinal de escala, não ROI. */
export function scoreOffer(s: OfferSignals, weights: ScoreWeights = SCORE_WEIGHTS): number {
  const parts = scoreParts(s);
  const total = weights.volume + weights.longevity + weights.acceleration + weights.shielding;
  if (total <= 0) return 0;
  const raw =
    parts.volume * weights.volume +
    parts.longevity * weights.longevity +
    parts.acceleration * weights.acceleration +
    parts.shielding * weights.shielding;
  return Math.round((raw / total) * 1000) / 10;
}

export type Cut = { minAds: number; minDays: number; minPages: number; formats: string[] };

export const DEFAULT_CUT: Cut = { minAds: 5, minDays: 7, minPages: 2, formats: [] };

export function passesCut(s: OfferSignals, cut: Cut): boolean {
  if (s.activeAds < cut.minAds) return false;
  if (cut.minDays > 0 && (s.oldestActiveDays === null || s.oldestActiveDays < cut.minDays)) return false;
  if (s.pageCount < cut.minPages) return false;
  if (cut.formats.length > 0 && !s.formats.some((f) => cut.formats.includes(f))) return false;
  return true;
}
