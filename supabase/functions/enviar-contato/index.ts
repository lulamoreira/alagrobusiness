// Public contact form submission. verify_jwt = false.
// Writes into public.contatos via service_role. Basic anti-spam.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  nome?: string;
  email?: string;
  assunto?: string;
  mensagem?: string;
  origem?: string;
  hp?: string; // honeypot
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  let payload: Payload;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  // Honeypot: bots fill hidden field; humans don't.
  if (payload.hp && payload.hp.trim() !== "") {
    return json(200, { ok: true }); // silently accept
  }

  const nome = (payload.nome ?? "").trim();
  const email = (payload.email ?? "").trim().toLowerCase();
  const assunto = (payload.assunto ?? "").trim();
  const mensagem = (payload.mensagem ?? "").trim();

  if (nome.length < 2 || nome.length > 120) return json(400, { error: "invalid_nome" });
  if (!EMAIL_RE.test(email) || email.length > 255) return json(400, { error: "invalid_email" });
  if (assunto.length < 2 || assunto.length > 160) return json(400, { error: "invalid_assunto" });
  if (mensagem.length < 10 || mensagem.length > 4000) return json(400, { error: "invalid_mensagem" });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    null;
  const ua = req.headers.get("user-agent") || null;

  // Rate limit: no more than 3 messages from same email in last 10 minutes
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("contatos")
    .select("id", { count: "exact", head: true })
    .eq("email", email)
    .gte("created_at", tenMinAgo);
  if ((count ?? 0) >= 3) return json(429, { error: "rate_limited" });

  const { data, error } = await supabase
    .from("contatos")
    .insert({
      nome,
      email,
      assunto,
      mensagem,
      ip,
      user_agent: ua,
      origem: payload.origem ?? null,
    })
    .select("id, created_at")
    .single();

  if (error) return json(500, { error: "insert_failed", detail: error.message });
  return json(200, { ok: true, id: data.id, created_at: data.created_at });
});
