// Busca cotações agro em fontes públicas e extrai com IA (Lovable AI Gateway).
// Apenas admin pode invocar. Retorna SUGESTÕES (não grava).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface FontePub {
  nome: string;
  url: string;
}

const FONTES: FontePub[] = [
  { nome: "CEPEA - Indicadores", url: "https://www.cepea.esalq.usp.br/br/indicador/soja.aspx" },
  { nome: "CEPEA - Milho", url: "https://www.cepea.esalq.usp.br/br/indicador/milho.aspx" },
  { nome: "CEPEA - Café", url: "https://www.cepea.esalq.usp.br/br/indicador/cafe.aspx" },
  { nome: "CEPEA - Boi", url: "https://www.cepea.esalq.usp.br/br/indicador/boi-gordo.aspx" },
  { nome: "Notícias Agrícolas - Cotações", url: "https://www.noticiasagricolas.com.br/cotacoes/" },
];

const PRODUTOS_ALVO = [
  "soja", "milho", "cafe_arabica", "cafe_conilon", "boi_gordo",
  "suino", "trigo", "algodao", "arroz", "feijao",
];

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchFonte(f: FontePub): Promise<{ fonte: FontePub; texto: string } | { fonte: FontePub; erro: string }> {
  try {
    const r = await fetch(f.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EntrepostoVirtual/1.0)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return { fonte: f, erro: `HTTP ${r.status}` };
    const html = await r.text();
    return { fonte: f, texto: stripHtml(html).slice(0, 6000) };
  } catch (err) {
    return { fonte: f, erro: String(err) };
  }
}

async function extrairComIA(amostras: { fonte: FontePub; texto: string }[], lovableKey: string) {
  const blocos = amostras
    .map((a, i) => `### FONTE ${i + 1}: ${a.fonte.nome} (${a.fonte.url})\n${a.texto}`)
    .join("\n\n");
  const prompt = `Você é um extrator de cotações agropecuárias brasileiras. Abaixo há textos extraídos de páginas públicas de cotações. Identifique, quando houver, o preço ATUAL (mais recente) de cada um destes produtos: ${PRODUTOS_ALVO.join(", ")}. Retorne SOMENTE itens que você efetivamente encontrou no texto — não invente valores. Para cada item, escolha a fonte_url da página onde o valor foi encontrado.\n\nTEXTOS:\n${blocos}`;

  const body = {
    model: "google/gemini-2.5-flash",
    messages: [
      { role: "system", content: "Você extrai cotações agro de textos. Responda apenas via tool call." },
      { role: "user", content: prompt },
    ],
    tools: [{
      type: "function",
      function: {
        name: "registrar_cotacoes",
        description: "Registra a lista de cotações encontradas",
        parameters: {
          type: "object",
          properties: {
            cotacoes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  produto: { type: "string", enum: PRODUTOS_ALVO },
                  valor: { type: "number" },
                  unidade: { type: "string", description: "saca_60, tonelada, arroba, kg, caixa" },
                  moeda: { type: "string", enum: ["BRL", "USD"] },
                  fonte_url: { type: "string" },
                },
                required: ["produto", "valor", "unidade", "fonte_url"],
              },
            },
          },
          required: ["cotacoes"],
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "registrar_cotacoes" } },
  };

  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": lovableKey,
      "X-Lovable-AIG-SDK": "raw",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const err = await r.text();
    throw new Error(`AI gateway HTTP ${r.status}: ${err.slice(0, 300)}`);
  }
  const j = await r.json();
  const toolCall = j?.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall) return [];
  const args = JSON.parse(toolCall.function?.arguments ?? "{}");
  return Array.isArray(args?.cotacoes) ? args.cotacoes : [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const LOVABLE_KEY = Deno.env.get("LOVABLE_API_KEY");

  // Autenticação: exige Authorization Bearer do usuário admin
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  // Detecta role do JWT; service_role pode invocar diretamente (jobs/admin tooling).
  let isServiceRole = false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
    isServiceRole = payload?.role === "service_role";
  } catch { /* token não-JWT, segue para auth */ }

  if (!isServiceRole) {
    const { data: userRes, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userRes?.user) {
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: userRes.user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }


  if (!LOVABLE_KEY) {
    return new Response(JSON.stringify({
      ok: false,
      error: "missing_lovable_api_key",
      hint: "LOVABLE_API_KEY não configurada no projeto.",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const logs: Record<string, string> = {};
  const amostras: { fonte: FontePub; texto: string }[] = [];
  const resultados = await Promise.all(FONTES.map(fetchFonte));
  for (const r of resultados) {
    if ("texto" in r) amostras.push(r);
    else logs[r.fonte.url] = r.erro;
  }

  if (amostras.length === 0) {
    return new Response(JSON.stringify({
      ok: false, error: "nenhuma_fonte_acessivel", logs,
    }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let cotacoes: unknown[] = [];
  try {
    cotacoes = await extrairComIA(amostras, LOVABLE_KEY);
  } catch (err) {
    return new Response(JSON.stringify({
      ok: false, error: "ia_falhou", detail: String(err), logs,
    }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({
    ok: true,
    cotacoes,
    fontes_consultadas: amostras.map((a) => ({ nome: a.fonte.nome, url: a.fonte.url })),
    logs,
  }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
