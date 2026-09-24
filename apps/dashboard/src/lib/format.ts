const HIDDEN_MONEY = "R$ •••••";
const HIDDEN_NUMBER = "••••";

const currencyFormatters = new Map<string, Intl.NumberFormat>();

function currencyFormatter(currency: string): Intl.NumberFormat {
  let formatter = currencyFormatters.get(currency);
  if (!formatter) {
    formatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency });
    currencyFormatters.set(currency, formatter);
  }
  return formatter;
}

const integerFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const signedPercentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
});

function safe(value: number | null | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function formatMoney(value: number | null | undefined, currency = "BRL", hidden = false): string {
  if (hidden) return HIDDEN_MONEY;
  return currencyFormatter(currency).format(safe(value));
}

export function formatInteger(value: number | null | undefined, hidden = false): string {
  if (hidden) return HIDDEN_NUMBER;
  return integerFormatter.format(safe(value));
}

export function formatDecimal(value: number | null | undefined, digits = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(safe(value));
}

/** Taxa já em pontos percentuais (1.5 → "1,50%"). */
export function formatRate(value: number | null | undefined, digits = 2): string {
  return `${formatDecimal(value, digits)}%`;
}

/** Variação em pontos percentuais com sinal (12.3 → "+12,3%"). */
export function formatVariation(value: number | null | undefined): string {
  return signedPercentFormatter.format(safe(value) / 100);
}

export function formatRatio(value: number | null | undefined, hidden = false): string {
  if (hidden) return HIDDEN_NUMBER;
  return `${formatDecimal(value, 2)}x`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
