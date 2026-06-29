// Busca previsão do tempo (Open-Meteo) para as regiões dos perfis e atualiza public.clima.
// Upsert manual (select->update/insert), best-effort por região.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

function checkCronAuth(req: Request): Response | null {
  const expected = Deno.env.get("CRON_SECRET");
  if (!expected) {
    return new Response(JSON.stringify({ error: "CRON_SECRET not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const provided = req.headers.get("x-cron-secret");
  if (!provided || provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

// Mapeia weather_code (WMO) -> chave i18n estável.
function condicaoFromCode(code: number | null | undefined): string {
  if (code == null) return "weather.unknown";
  if (code === 0) return "weather.clear";
  if (code === 1 || code === 2) return "weather.partlyCloudy";
  if (code === 3) return "weather.cloudy";
  if (code === 45 || code === 48) return "weather.fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "weather.drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "weather.rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "weather.snow";
  if ([95, 96, 99].includes(code)) return "weather.thunderstorm";
  return "weather.unknown";
}

async function safeFetchJson(url: string, tries = 3): Promise<any | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "ALAGROBUSINESS/1.0", Accept: "application/json" },
      });
      if (r.ok) return await r.json();
      if (r.status !== 429 && r.status < 500) return null;
    } catch (_) { /* network */ }
    await new Promise((res) => setTimeout(res, 1000 * (i + 1)));
  }
  return null;
}

async function geocode(cidade: string, estado: string | null): Promise<{ lat: number; lon: number } | null> {
  const q = encodeURIComponent(cidade);
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${q}&country=BR&count=5&language=pt&format=json`;
  const j = await safeFetchJson(url);
  const results: any[] = j?.results ?? [];
  if (results.length === 0) return null;
  const match = estado
    ? results.find((r) => (r.admin1 ?? "").toLowerCase() === estado.toLowerCase()) ?? results[0]
    : results[0];
  return { lat: Number(match.latitude), lon: Number(match.longitude) };
}

async function upsertClima(
  supabase: ReturnType<typeof createClient>,
  regiao: string,
  payload: { temperatura: number | null; condicao: string; previsao: unknown },
) {
  const atualizado_em = new Date().toISOString();
  const row = { ...payload, atualizado_em };
  const { data: upd, error: updErr } = await supabase
    .from("clima")
    .update(row)
    .eq("regiao", regiao)
    .is("deleted_at", null)
    .select("id");
  if (updErr) throw updErr;
  if (!upd || upd.length === 0) {
    const { error: insErr } = await supabase
      .from("clima")
      .insert({ regiao, ...row });
    if (insErr) throw insErr;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authErr = checkCronAuth(req);
  if (authErr) return authErr;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Regiões distintas a partir de profiles.
  const { data: profs, error: profErr } = await supabase
    .from("profiles")
    .select("cidade, estado, latitude, longitude")
    .is("deleted_at", null)
    .not("cidade", "is", null);

  if (profErr) {
    return new Response(JSON.stringify({ ok: false, error: String(profErr.message) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const seen = new Map<string, { cidade: string; estado: string | null; lat: number | null; lon: number | null }>();
  for (const p of profs ?? []) {
    const cidade = (p.cidade as string | null)?.trim();
    if (!cidade) continue;
    const estado = ((p.estado as string | null) ?? "").trim() || null;
    const key = `${cidade} - ${estado ?? ""}`.trim();
    const prev = seen.get(key);
    const lat = p.latitude != null ? Number(p.latitude) : null;
    const lon = p.longitude != null ? Number(p.longitude) : null;
    if (!prev || (prev.lat == null && lat != null)) {
      seen.set(key, { cidade, estado, lat, lon });
    }
  }

  const results: Array<{ regiao: string; status: string; error?: string }> = [];

  for (const [regiao, info] of seen.entries()) {
    try {
      let lat = info.lat;
      let lon = info.lon;
      if (lat == null || lon == null) {
        const g = await geocode(info.cidade, info.estado);
        if (!g) {
          results.push({ regiao, status: "skipped", error: "geocode_not_found" });
          continue;
        }
        lat = g.lat;
        lon = g.lon;
      }
      const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&current=temperature_2m,weather_code` +
        `&daily=weather_code,temperature_2m_max,temperature_2m_min` +
        `&timezone=auto&forecast_days=5`;
      const j = await safeFetchJson(url);
      if (!j) {
        results.push({ regiao, status: "error", error: "forecast_fetch_failed" });
        continue;
      }
      const curTemp = j?.current?.temperature_2m ?? null;
      const curCode = j?.current?.weather_code ?? null;
      const condicao = condicaoFromCode(curCode);

      const dailyTimes: string[] = j?.daily?.time ?? [];
      const dailyMax: number[] = j?.daily?.temperature_2m_max ?? [];
      const dailyMin: number[] = j?.daily?.temperature_2m_min ?? [];
      const dailyCode: number[] = j?.daily?.weather_code ?? [];

      const previsao = dailyTimes.map((d, i) => ({
        data: d,
        min: dailyMin[i] ?? null,
        max: dailyMax[i] ?? null,
        weather_code: dailyCode[i] ?? null,
        condicao: condicaoFromCode(dailyCode[i]),
      }));

      await upsertClima(supabase, regiao, {
        temperatura: curTemp != null ? Number(curTemp) : null,
        condicao,
        previsao,
      });
      results.push({ regiao, status: "ok" });
    } catch (err) {
      console.error("fetch-clima region error", regiao, err);
      results.push({ regiao, status: "error", error: String((err as Error)?.message ?? err) });
    }
  }

  return new Response(JSON.stringify({ ok: true, count: results.length, results }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
