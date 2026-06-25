// Fetch USD-BRL (comercial) e USD-BRL-T (turismo) da AwesomeAPI e faz upsert em cotacoes_dolar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const results: Record<string, unknown> = {};
  try {
    let resp: Response | null = null;
    for (let i = 0; i < 3; i++) {
      resp = await fetch("https://economia.awesomeapi.com.br/json/last/USD-BRL,USD-BRL-T", {
        headers: { "User-Agent": "ALAGROBUSINESS/1.0", Accept: "application/json" },
      });
      if (resp.ok) break;
      if (resp.status === 429 || resp.status >= 500) {
        await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
        continue;
      }
      break;
    }
    if (!resp || !resp.ok) throw new Error(`AwesomeAPI HTTP ${resp?.status ?? "no-response"}`);
    const data = await resp.json();

    const rows: { tipo: "comercial" | "turismo"; valor_brl: number; atualizado_em: string }[] = [];
    const comercial = data?.USDBRL;
    const turismo = data?.USDBRLT;

    if (comercial?.bid) {
      rows.push({
        tipo: "comercial",
        valor_brl: Number(comercial.bid),
        atualizado_em: new Date().toISOString(),
      });
    }
    if (turismo?.bid) {
      rows.push({
        tipo: "turismo",
        valor_brl: Number(turismo.bid),
        atualizado_em: new Date().toISOString(),
      });
    }

    for (const row of rows) {
      // update-or-insert para respeitar índice único parcial (WHERE deleted_at IS NULL)
      const { data: upd, error: updErr } = await supabase
        .from("cotacoes_dolar")
        .update({ valor_brl: row.valor_brl, atualizado_em: row.atualizado_em })
        .eq("tipo", row.tipo)
        .is("deleted_at", null)
        .select("id");
      if (updErr) throw updErr;
      if (!upd || upd.length === 0) {
        const { error: insErr } = await supabase.from("cotacoes_dolar").insert(row);
        if (insErr) throw insErr;
      }
      results[row.tipo] = row.valor_brl;
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("fetch-dolar error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err), results }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
