// Traduz mensagens de uma conversa para o idioma do destinatário.
// - Só participantes da conversa (comprador/vendedor) podem chamar.
// - Usa Lovable AI Gateway (mesmo padrão de buscar-cotacoes).
// - Cacheia resultados em public.mensagens_traducoes (service_role only).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const IDIOMA_LABEL: Record<string, string> = {
  "pt-BR": "Português (Brasil)",
  en: "Inglês",
  es: "Espanhol",
};

interface Body {
  conversa_id?: string;
  idioma_destino?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: userRes, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userRes?.user) return json({ ok: false, error: "unauthorized" }, 401);
  const userId = userRes.user.id;

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "bad_json" }, 400);
  }
  const conversaId = body.conversa_id?.trim();
  const idiomaDestino = body.idioma_destino?.trim();
  if (!conversaId || !idiomaDestino || !IDIOMA_LABEL[idiomaDestino]) {
    return json({ ok: false, error: "invalid_input" }, 400);
  }
  if (!LOVABLE_KEY) return json({ ok: false, error: "missing_lovable_api_key" }, 500);

  // Verifica participação
  const { data: conv, error: convErr } = await admin
    .from("conversas")
    .select("id, comprador_id, vendedor_id")
    .eq("id", conversaId)
    .is("deleted_at", null)
    .maybeSingle();
  if (convErr || !conv) return json({ ok: false, error: "not_found" }, 404);
  if (conv.comprador_id !== userId && conv.vendedor_id !== userId) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  // Carrega mensagens
  const { data: mensagens, error: msgErr } = await admin
    .from("mensagens")
    .select("id, conteudo, idioma")
    .eq("conversa_id", conversaId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (msgErr) return json({ ok: false, error: "db_error", detail: msgErr.message }, 500);

  const alvo = (mensagens ?? []).filter(
    (m) => (m.idioma ?? null) !== idiomaDestino,
  );
  if (alvo.length === 0) return json({ ok: true, translations: {} }, 200);

  // Busca cache existente
  const ids = alvo.map((m) => m.id);
  const { data: cacheRows } = await admin
    .from("mensagens_traducoes")
    .select("mensagem_id, texto")
    .in("mensagem_id", ids)
    .eq("idioma", idiomaDestino);
  const cached: Record<string, string> = {};
  for (const r of cacheRows ?? []) cached[r.mensagem_id as string] = r.texto as string;

  const faltantes = alvo.filter((m) => !(m.id in cached));

  let novos: Record<string, string> = {};
  if (faltantes.length > 0) {
    const numerada = faltantes.map((m, i) => `[${i + 1}] ${m.conteudo}`).join("\n");
    const alvoLabel = IDIOMA_LABEL[idiomaDestino];
    const prompt = `Traduza os textos abaixo para ${alvoLabel}. Preserve o significado, tom e emojis. NUNCA adicione comentários. Responda SOMENTE via tool call, na MESMA ORDEM da entrada.\n\n${numerada}`;

    const aiBody = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: "Você traduz mensagens de chat preservando o significado." },
        { role: "user", content: prompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "registrar_traducoes",
          description: "Registra as traduções na ordem recebida",
          parameters: {
            type: "object",
            properties: {
              traducoes: {
                type: "array",
                items: { type: "string" },
                description: "Traduções na mesma ordem da entrada",
              },
            },
            required: ["traducoes"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "registrar_traducoes" } },
    };

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_KEY}`,
        "X-Lovable-AIG-SDK": "raw",
      },
      body: JSON.stringify(aiBody),
    });
    if (!r.ok) {
      const errText = await r.text();
      return json({ ok: false, error: "ai_failed", detail: errText.slice(0, 300) }, 502);
    }
    const j = await r.json();
    const toolCall = j?.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function?.arguments ?? "{}") : {};
    const traducoes: string[] = Array.isArray(args?.traducoes) ? args.traducoes : [];

    const inserts: { mensagem_id: string; idioma: string; texto: string }[] = [];
    faltantes.forEach((m, i) => {
      const texto = traducoes[i];
      if (typeof texto === "string" && texto.trim().length > 0) {
        novos[m.id] = texto;
        inserts.push({ mensagem_id: m.id, idioma: idiomaDestino, texto });
      }
    });
    if (inserts.length > 0) {
      await admin.from("mensagens_traducoes").upsert(inserts, {
        onConflict: "mensagem_id,idioma",
      });
    }
  }

  return json({ ok: true, translations: { ...cached, ...novos } }, 200);
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
