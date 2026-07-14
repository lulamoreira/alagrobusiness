/**
 * ISO 3166-1 alpha-2 country codes used across the app for export destinations
 * and the user's country. Kept as a curated list of major trading partners to
 * keep the multi-select usable; extend as needed.
 *
 * Names are always rendered via `Intl.DisplayNames(locale, { type: 'region' })`
 * — never store translated names in the DB.
 */
export const COUNTRY_CODES = [
  "AR", "AT", "AU", "BE", "BO", "BR", "CA", "CH", "CL", "CN",
  "CO", "CR", "CU", "CZ", "DE", "DK", "EC", "EG", "ES", "FI",
  "FR", "GB", "GR", "HK", "IE", "IL", "IN", "IT", "JP", "KR",
  "MA", "MX", "NL", "NO", "NZ", "PE", "PH", "PL", "PT", "PY",
  "QA", "RO", "RU", "SA", "SE", "SG", "TH", "TR", "TW", "UA",
  "US", "UY", "VE", "VN", "ZA",
] as const;

export type CountryCode = (typeof COUNTRY_CODES)[number];

/**
 * Returns the localized country name for a given ISO alpha-2 code, or the code
 * itself as a safe fallback. Uses `Intl.DisplayNames` — no i18n table needed.
 */
export function countryName(code: string | null | undefined, locale = "pt-BR"): string {
  if (!code) return "";
  try {
    const dn = new Intl.DisplayNames([locale], { type: "region" });
    return dn.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

/** Sorted country list localized for a UI select. */
export function listCountries(locale = "pt-BR"): { code: CountryCode; name: string }[] {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code, locale) })).sort((a, b) =>
    a.name.localeCompare(b.name, locale),
  );
}

export const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"] as const;
export type Incoterm = (typeof INCOTERMS)[number];
