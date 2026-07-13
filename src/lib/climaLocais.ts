import { supabase } from "@/integrations/supabase/client";

export type ClimaLocal = {
  id: string;
  cidade: string;
  estado: string | null;
  regiao: string;
  ordem: number;
};

export function buildRegiaoKey(
  cidade: string | null | undefined,
  estado: string | null | undefined,
): string | null {
  const c = (cidade ?? "").trim();
  if (!c) return null;
  const e = (estado ?? "").trim();
  return `${c} - ${e}`.trim();
}

export type GeocodeHit = {
  name: string;
  admin1: string | null;
  country_code: string | null;
  latitude: number;
  longitude: number;
};

export async function geocodeCity(query: string, signal?: AbortSignal): Promise<GeocodeHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url =
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}` +
    `&country=BR&count=8&language=pt&format=json`;
  const r = await fetch(url, { signal });
  if (!r.ok) return [];
  const j = (await r.json()) as { results?: GeocodeHit[] };
  return (j.results ?? []).map((h) => ({
    name: h.name,
    admin1: h.admin1 ?? null,
    country_code: h.country_code ?? null,
    latitude: Number(h.latitude),
    longitude: Number(h.longitude),
  }));
}

export async function listMeusLocais(usuarioId: string): Promise<ClimaLocal[]> {
  const { data, error } = await supabase
    .from("usuario_clima_locais")
    .select("id, cidade, estado, regiao, ordem")
    .eq("usuario_id", usuarioId)
    .is("deleted_at", null)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as ClimaLocal[];
}

export async function addLocal(
  usuarioId: string,
  cidade: string,
  estado: string | null,
): Promise<void> {
  const regiao = buildRegiaoKey(cidade, estado);
  if (!regiao) return;
  const { error } = await supabase
    .from("usuario_clima_locais")
    .insert({ usuario_id: usuarioId, cidade, estado, regiao });
  if (error && error.code !== "23505") throw error; // ignore duplicate
}

export async function removeLocal(id: string): Promise<void> {
  const { error } = await supabase.from("usuario_clima_locais").delete().eq("id", id);
  if (error) throw error;
}
