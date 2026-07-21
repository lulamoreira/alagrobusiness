// Busca cotações USD-BRL (comercial) e turismo, faz upsert manual em cotacoes_dolar.
// Estratégia anti-429: comercial via open.er-api.com (sem rate-limit estrito),
// turismo via AwesomeAPI USD-BRL-T com retry e fallback (comercial * 1.04).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

async function checkCronAuth(
  req: Request,
  supabase: ReturnType<typeof createClient>,
): Promise<Response | null> {
  const provided = req.headers.get("x-cron-secret");
  if (!provided) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: expected, error } = await supabase.rpc("get_cron_secret");
  if (error || !expected) {
    return new Response(JSON.stringify({ error: "Server auth not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return null;
}

async function fetchWithRetry(url: string, tries = 3): Promise<Response | null> {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": "EntrepostoVirtual/1.0", Accept: "application/json" },
      });
      if (r.ok) return r;
      if (r.status !== 429 && r.status < 500) return r;
    } catch (_e) { /* network */ }
    await new Promise((res) => setTimeout(res, 1200 * (i + 1)));
  }
  return null;
}

async function upsertCotacao(
  supabase: ReturnType<typeof createClient>,
  tipo: "comercial" | "turismo",
  valor_brl: number,
) {
  const atualizado_em = new Date().toISOString();
  const { data: upd, error: updErr } = await supabase
    .from("cotacoes_dolar")
    .update({ valor_brl, atualizado_em })
    .eq("tipo", tipo)
    .is("deleted_at", null)
    .select("id");
  if (updErr) throw updErr;
  if (!upd || upd.length === 0) {
    const { error: insErr } = await supabase
      .from("cotacoes_dolar")
      .insert({ tipo, valor_brl, atualizado_em });
    if (insErr) throw insErr;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const authErr = await checkCronAuth(req, supabase);
  if (authErr) return authErr;

  const out: Record<string, unknown> = { sources: {} };
  let comercial: number | null = null;
  let turismo: number | null = null;
  let eur: number | null = null;
  let openErApiRates: Record<string, number> | null = null;

  // 1) Comercial — open.er-api.com (estável, sem 429). Também expõe todos os rates para derivar EUR.
  try {
    const r = await fetchWithRetry("https://open.er-api.com/v6/latest/USD");
    if (!r || !r.ok) throw new Error(`open.er-api HTTP ${r?.status ?? "no-response"}`);
    const j = await r.json();
    const brl = j?.rates?.BRL;
    if (typeof brl !== "number") throw new Error("BRL ausente em open.er-api");
    comercial = brl;
    openErApiRates = j?.rates ?? null;
    (out.sources as Record<string, unknown>).comercial = "open.er-api.com";
  } catch (err) {
    // fallback AwesomeAPI
    try {
      const r = await fetchWithRetry("https://economia.awesomeapi.com.br/json/last/USD-BRL");
      if (!r || !r.ok) throw new Error(`AwesomeAPI USD-BRL HTTP ${r?.status ?? "no-response"}`);
      const j = await r.json();
      const bid = j?.USDBRL?.bid;
      comercial = bid ? Number(bid) : null;
      (out.sources as Record<string, unknown>).comercial = "awesomeapi.com.br (fallback)";
    } catch (err2) {
      (out.sources as Record<string, unknown>).comercial_error =
        `${String(err)} | ${String(err2)}`;
    }
  }

  // 2) Turismo — AwesomeAPI USD-BRL-T
  try {
    const r = await fetchWithRetry("https://economia.awesomeapi.com.br/json/last/USD-BRL-T");
    if (!r || !r.ok) throw new Error(`AwesomeAPI USD-BRL-T HTTP ${r?.status ?? "no-response"}`);
    const j = await r.json();
    const bid = j?.USDBRLT?.bid;
    turismo = bid ? Number(bid) : null;
    (out.sources as Record<string, unknown>).turismo = "awesomeapi.com.br";
  } catch (err) {
    if (comercial != null) {
      turismo = Number((comercial * 1.04).toFixed(4));
      (out.sources as Record<string, unknown>).turismo = "derived (comercial * 1.04)";
      (out.sources as Record<string, unknown>).turismo_warn = String(err);
    } else {
      (out.sources as Record<string, unknown>).turismo_error = String(err);
    }
  }

  // 3) EUR — AwesomeAPI EUR-BRL, com fallback via open.er-api (rates.BRL / rates.EUR).
  try {
    const r = await fetchWithRetry("https://economia.awesomeapi.com.br/json/last/EUR-BRL");
    if (!r || !r.ok) throw new Error(`AwesomeAPI EUR-BRL HTTP ${r?.status ?? "no-response"}`);
    const j = await r.json();
    const bid = j?.EURBRL?.bid;
    eur = bid ? Number(bid) : null;
    (out.sources as Record<string, unknown>).eur = "awesomeapi.com.br";
  } catch (err) {
    // Fallback: derivar via open.er-api já baixado (BRL por USD / EUR por USD = BRL por EUR)
    const brlPerUsd = openErApiRates?.BRL;
    const eurPerUsd = openErApiRates?.EUR;
    if (brlPerUsd && eurPerUsd && eurPerUsd > 0) {
      eur = Number((brlPerUsd / eurPerUsd).toFixed(4));
      (out.sources as Record<string, unknown>).eur = "derived (open.er-api BRL/EUR)";
      (out.sources as Record<string, unknown>).eur_warn = String(err);
    } else {
      (out.sources as Record<string, unknown>).eur_error = String(err);
    }
  }


  async function upsertHistorico(tipo: "comercial" | "turismo", valor: number) {
    const hoje = new Date().toISOString().slice(0, 10);
    const { data: upd, error: updErr } = await supabase
      .from("cotacoes_dolar_historico")
      .update({ valor_brl: valor })
      .eq("tipo", tipo)
      .eq("data", hoje)
      .is("deleted_at", null)
      .select("id");
    if (updErr) throw updErr;
    if (!upd || upd.length === 0) {
      const { error: insErr } = await supabase
        .from("cotacoes_dolar_historico")
        .insert({ tipo, valor_brl: valor, data: hoje });
      if (insErr) throw insErr;
    }
  }

  async function upsertCambio(moeda: "USD" | "EUR", valor: number, fonte: string) {
    const { error } = await supabase
      .from("cotacoes_cambio")
      .upsert(
        { moeda, valor_brl: valor, fonte, atualizado_em: new Date().toISOString() },
        { onConflict: "moeda" },
      );
    if (error) throw error;
  }

  try {
    if (comercial != null) {
      await upsertCotacao(supabase, "comercial", comercial);
      await upsertHistorico("comercial", comercial);
      await upsertCambio("USD", comercial, String((out.sources as Record<string, unknown>).comercial ?? ""));
      (out as Record<string, unknown>).comercial = comercial;
    }
    if (turismo != null) {
      await upsertCotacao(supabase, "turismo", turismo);
      await upsertHistorico("turismo", turismo);
      (out as Record<string, unknown>).turismo = turismo;
    }
    if (eur != null) {
      await upsertCambio("EUR", eur, String((out.sources as Record<string, unknown>).eur ?? ""));
      (out as Record<string, unknown>).eur = eur;
    }
  } catch (err) {
    console.error("upsert cotacoes:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err), ...out }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }


  return new Response(JSON.stringify({ ok: true, ...out }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

