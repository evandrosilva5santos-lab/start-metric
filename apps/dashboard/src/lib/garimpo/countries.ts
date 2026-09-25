/** A Biblioteca só devolve anúncios comerciais que alcançaram UE/Reino Unido. */
export const COMMERCIAL_COUNTRIES = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU",
  "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "GB",
]);

export const SCAN_COUNTRIES: Array<{ code: string; label: string }> = [
  { code: "BR", label: "Brasil" },
  { code: "PT", label: "Portugal" },
  { code: "US", label: "Estados Unidos" },
  { code: "GB", label: "Reino Unido" },
  { code: "ES", label: "Espanha" },
  { code: "DE", label: "Alemanha" },
  { code: "FR", label: "França" },
  { code: "IT", label: "Itália" },
  { code: "MX", label: "México" },
  { code: "AR", label: "Argentina" },
  { code: "CO", label: "Colômbia" },
];
