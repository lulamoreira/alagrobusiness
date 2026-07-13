/**
 * CEP → address + coordinates helper. All requests are client-side (public APIs).
 * Returns null when the CEP is invalid; individual fields are null when unknown.
 */
export interface GeocodeResult {
  cidade: string | null;
  estado: string | null;
  logradouro: string | null;
  bairro: string | null;
  latitude: number | null;
  longitude: number | null;
}

function onlyDigits(v: string): string {
  return (v || "").replace(/\D+/g, "");
}

function toNum(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function tryBrasilApi(cep8: string): Promise<GeocodeResult | null> {
  try {
    const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep8}`);
    if (!res.ok) return null;
    const j = await res.json();
    const coords = j?.location?.coordinates ?? {};
    return {
      cidade: j?.city ?? null,
      estado: j?.state ?? null,
      logradouro: j?.street ?? null,
      bairro: j?.neighborhood ?? null,
      latitude: toNum(coords?.latitude),
      longitude: toNum(coords?.longitude),
    };
  } catch {
    return null;
  }
}

async function tryViaCep(cep8: string): Promise<GeocodeResult | null> {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep8}/json/`);
    if (!res.ok) return null;
    const j = await res.json();
    if (j?.erro) return null;
    return {
      cidade: j?.localidade ?? null,
      estado: j?.uf ?? null,
      logradouro: j?.logradouro ?? null,
      bairro: j?.bairro ?? null,
      latitude: null,
      longitude: null,
    };
  } catch {
    return null;
  }
}

async function tryNominatim(
  cep8: string,
  cidade?: string | null,
  estado?: string | null,
): Promise<{ latitude: number | null; longitude: number | null }> {
  const attempts: string[] = [
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&country=Brazil&postalcode=${cep8}`,
  ];
  if (cidade && estado) {
    const q = encodeURIComponent(`${cidade}, ${estado}, Brazil`);
    attempts.push(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${q}`);
  }
  for (const url of attempts) {
    try {
      const res = await fetch(url, { headers: { Accept: "application/json" } });
      if (!res.ok) continue;
      const arr = await res.json();
      const first = Array.isArray(arr) ? arr[0] : null;
      const lat = toNum(first?.lat);
      const lon = toNum(first?.lon);
      if (lat != null && lon != null) return { latitude: lat, longitude: lon };
    } catch {
      // ignore
    }
  }
  return { latitude: null, longitude: null };
}

export async function geocodeCep(cep: string): Promise<GeocodeResult | null> {
  const cep8 = onlyDigits(cep);
  if (cep8.length !== 8) return null;

  let result = await tryBrasilApi(cep8);
  if (!result) {
    result = await tryViaCep(cep8);
  }
  if (!result) {
    // Nothing at all — return coordinates-only if possible so callers can still store lat/long.
    const coords = await tryNominatim(cep8);
    if (coords.latitude == null) return null;
    return {
      cidade: null,
      estado: null,
      logradouro: null,
      bairro: null,
      ...coords,
    };
  }

  if (result.latitude == null || result.longitude == null) {
    const coords = await tryNominatim(cep8, result.cidade, result.estado);
    result = { ...result, ...coords };
  }
  return result;
}
