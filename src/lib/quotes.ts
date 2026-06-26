/**
 * Helpers for the public Quote screen.
 *
 * Pure data utilities — no React, no Supabase imports — so they can be unit-tested
 * trivially and reused from /cotacao and /painel without duplication.
 */

export type CommodityRow = {
  produto: string;
  valor: number;
  data: string; // ISO date "YYYY-MM-DD"
  fonte: "manual" | "auto" | "ia";
  fonte_url: string | null;
  unidade_id: string | null;
  moeda: "BRL" | "USD" | "EUR";
};

export type DolarHistoryRow = {
  tipo: "comercial" | "turismo" | "paralelo";
  valor_brl: number;
  data: string;
};

export interface Variation {
  /** signed delta (current - previous). null when only one point exists */
  delta: number | null;
  /** signed ratio (delta / previous). null when previous is 0 or missing */
  pct: number | null;
  /** direction for arrow rendering */
  direction: "up" | "down" | "flat" | "none";
}

/** Computes variation between the latest and the immediately previous data point. */
export function computeVariation(values: number[]): Variation {
  if (!values || values.length < 2) {
    return { delta: null, pct: null, direction: "none" };
  }
  const current = values[values.length - 1];
  const previous = values[values.length - 2];
  const delta = current - previous;
  const pct = previous !== 0 ? delta / previous : null;
  const direction: Variation["direction"] =
    Math.abs(delta) < 1e-9 ? "flat" : delta > 0 ? "up" : "down";
  return { delta, pct, direction };
}

/** Keeps history rows of a single key, sorted ascending by data. */
export function sortAsc<T extends { data: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => a.data.localeCompare(b.data));
}

/** Filters history rows to the last `days` calendar days from today. */
export function filterRange<T extends { data: string }>(rows: T[], days: 7 | 30): T[] {
  if (!rows || rows.length === 0) return [];
  const limit = new Date();
  limit.setUTCHours(0, 0, 0, 0);
  limit.setUTCDate(limit.getUTCDate() - (days - 1));
  const iso = limit.toISOString().slice(0, 10);
  return rows.filter((r) => r.data >= iso);
}

/** Returns the catalogued commodity keys we render on /cotacao (and admin/cotacoes). */
export const COMMODITY_KEYS = [
  "soja",
  "milho",
  "cafe_arabica",
  "cafe_conilon",
  "boi_gordo",
  "suino",
  "trigo",
  "algodao",
  "arroz",
  "feijao",
] as const;
export type CommodityKey = (typeof COMMODITY_KEYS)[number];

/** Default trio shown in the /painel summary card. */
export const PAINEL_FEATURED: CommodityKey[] = ["soja", "milho", "boi_gordo"];

/** Groups commodity rows by produto, sorted ascending by date. */
export function groupCommodityHistory(rows: CommodityRow[]): Map<string, CommodityRow[]> {
  const map = new Map<string, CommodityRow[]>();
  for (const r of rows) {
    const list = map.get(r.produto) ?? [];
    list.push(r);
    map.set(r.produto, list);
  }
  for (const [k, list] of map) map.set(k, sortAsc(list));
  return map;
}

/** Same grouping for dollar history. */
export function groupDolarHistory(rows: DolarHistoryRow[]): Map<string, DolarHistoryRow[]> {
  const map = new Map<string, DolarHistoryRow[]>();
  for (const r of rows) {
    const list = map.get(r.tipo) ?? [];
    list.push(r);
    map.set(r.tipo, list);
  }
  for (const [k, list] of map) map.set(k, sortAsc(list));
  return map;
}
