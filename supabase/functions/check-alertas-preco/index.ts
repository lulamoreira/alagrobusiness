// Verifica alertas de preço ativos e cria notificações quando a condição é satisfeita.
// Anti-spam: usa a flag `disparado` — só notifica no cruzamento (rearma quando a condição deixa de valer).
// Guard: exige header x-cron-secret (comparado via RPC get_cron_secret).
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

interface Alerta {
  id: string;
  usuario_id: string;
  tipo_alerta: "commodity" | "dolar";
  referencia: string;
  condicao: "acima" | "abaixo";
  valor_alvo: number;
  moeda: string;
  ativo: boolean;
  disparado: boolean;
}

function condicaoSatisfeita(c: "acima" | "abaixo", atual: number, alvo: number): boolean {
  return c === "acima" ? atual > alvo : atual < alvo;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const authErr = await checkCronAuth(req, supabase);
  if (authErr) return authErr;

  const summary = {
    checked: 0,
    notified: 0,
    rearmed: 0,
    skipped: 0,
    errors: [] as string[],
  };

  // Carrega alertas ativos
  const { data: alertas, error: alertasErr } = await supabase
    .from("alertas_preco")
    .select("id, usuario_id, tipo_alerta, referencia, condicao, valor_alvo, moeda, ativo, disparado")
    .eq("ativo", true)
    .is("deleted_at", null);

  if (alertasErr) {
    return new Response(JSON.stringify({ error: alertasErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Cache de cotações para evitar buscar a mesma várias vezes
  const cacheCommodity = new Map<string, { valor: number; moeda: string } | null>();
  const cacheDolar = new Map<string, { valor: number; moeda: string } | null>();

  async function getCommodity(produto: string) {
    if (cacheCommodity.has(produto)) return cacheCommodity.get(produto)!;
    const { data } = await supabase
      .from("cotacoes_commodities")
      .select("valor, moeda")
      .eq("produto", produto)
      .is("deleted_at", null)
      .order("data", { ascending: false })
      .limit(1)
      .maybeSingle();
    const v = data ? { valor: Number(data.valor), moeda: String(data.moeda) } : null;
    cacheCommodity.set(produto, v);
    return v;
  }

  async function getDolar(tipo: string) {
    if (cacheDolar.has(tipo)) return cacheDolar.get(tipo)!;
    const { data } = await supabase
      .from("cotacoes_dolar")
      .select("valor_brl, tipo")
      .eq("tipo", tipo)
      .is("deleted_at", null)
      .order("atualizado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    const v = data ? { valor: Number(data.valor_brl), moeda: "BRL" } : null;
    cacheDolar.set(tipo, v);
    return v;
  }

  for (const a of (alertas ?? []) as Alerta[]) {
    summary.checked++;
    try {
      const cot =
        a.tipo_alerta === "commodity"
          ? await getCommodity(a.referencia)
          : await getDolar(a.referencia);

      if (!cot) {
        summary.skipped++;
        console.log(`sem cotação para ${a.tipo_alerta}:${a.referencia}`);
        continue;
      }

      // Compara somente na mesma moeda (best-effort, sem conversão FX neste passo).
      if (cot.moeda !== a.moeda) {
        summary.skipped++;
        console.log(`moeda divergente alerta=${a.moeda} cotacao=${cot.moeda} (alerta ${a.id})`);
        continue;
      }

      const satisfeito = condicaoSatisfeita(a.condicao, cot.valor, Number(a.valor_alvo));

      if (satisfeito && !a.disparado) {
        // Cria notificação + marca disparado
        const titulo = a.tipo_alerta === "commodity"
          ? `alerts.notif.commodityTitle::${a.referencia}::${a.condicao}::${a.valor_alvo}::${a.moeda}`
          : `alerts.notif.dolarTitle::${a.referencia}::${a.condicao}::${a.valor_alvo}::${a.moeda}`;
        const mensagem = `alerts.notif.message::${cot.valor}::${cot.moeda}`;

        const { error: insErr } = await supabase.from("notificacoes").insert({
          usuario_id: a.usuario_id,
          tipo: "preco",
          titulo,
          mensagem,
          link: "/cotacao",
        });
        if (insErr) {
          summary.errors.push(`notif insert ${a.id}: ${insErr.message}`);
          continue;
        }
        const { error: updErr } = await supabase
          .from("alertas_preco")
          .update({ disparado: true, ultima_notificacao_em: new Date().toISOString() })
          .eq("id", a.id);
        if (updErr) {
          summary.errors.push(`flag update ${a.id}: ${updErr.message}`);
          continue;
        }
        summary.notified++;
      } else if (!satisfeito && a.disparado) {
        // Rearma o alerta
        const { error: updErr } = await supabase
          .from("alertas_preco")
          .update({ disparado: false })
          .eq("id", a.id);
        if (updErr) {
          summary.errors.push(`rearm ${a.id}: ${updErr.message}`);
          continue;
        }
        summary.rearmed++;
      }
    } catch (e) {
      summary.errors.push(`alerta ${a.id}: ${(e as Error).message}`);
    }
  }

  return new Response(JSON.stringify({ ok: true, ...summary }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
