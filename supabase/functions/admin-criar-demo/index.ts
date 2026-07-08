// Cria uma conta de demonstração (login+senha sintéticos) e registra um convite
// demo PENDENTE que só ativa no primeiro login. Somente admins podem chamar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEMO_DOMAIN = "demo.agro";

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

async function requireAdmin(authHeader: string | null) {
  if (!authHeader) return null;
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const client = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error } = await client.auth.getUser();
  if (error || !userRes?.user) return null;
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: isAdmin } = await service.rpc("has_admin_perm", {
    _uid: userRes.user.id,
    _perm: "acessos",
  });
  return isAdmin === true ? userRes.user : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return j(405, { error: "method_not_allowed" });

  const admin = await requireAdmin(req.headers.get("Authorization"));
  if (!admin) return j(403, { error: "nao_autorizado" });

  let body: {
    login?: string;
    senha?: string;
    label?: string;
    plano?: string;
    dias?: number;
  };
  try {
    body = await req.json();
  } catch {
    return j(400, { error: "json_invalido" });
  }

  const loginRaw = (body.login ?? "").trim().toLowerCase();
  const senha = (body.senha ?? "").trim();
  const label = (body.label ?? "").trim();
  const plano = (body.plano ?? "pro").trim();
  const dias = Math.max(1, Math.round(Number(body.dias ?? 2)));

  if (!loginRaw || loginRaw.length < 2) return j(400, { error: "login_invalido" });
  if (!senha || senha.length < 6) return j(400, { error: "senha_invalida" });

  const email = loginRaw.includes("@") ? loginRaw : `${loginRaw.replace(/[^a-z0-9._-]/g, "")}@${DEMO_DOMAIN}`;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return j(400, { error: "email_invalido" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Valida plano
  const { data: planoRow } = await service
    .from("planos")
    .select("codigo")
    .eq("codigo", plano)
    .eq("ativo", true)
    .is("deleted_at", null)
    .maybeSingle();
  if (!planoRow) return j(400, { error: "plano_invalido" });

  // Cria usuário confirmado
  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true,
    user_metadata: {
      tipo_perfil: "comprador",
      lgpd_aceito: true,
      nome_completo: label || loginRaw,
      is_demo: true,
    },
  });
  if (createErr || !created?.user) {
    return j(400, { error: "criar_usuario_falhou", detail: createErr?.message });
  }

  // Garante is_demo=true no perfil (o trigger já usa is_demo do metadata, mas
  // reforçamos para caso o perfil tenha sido criado antes do metadata).
  await service.from("profiles").update({ is_demo: true }).eq("id", created.user.id);

  // Registra convite demo PENDENTE
  const { data: convite, error: convErr } = await service
    .from("convites_cortesia")
    .insert({
      email,
      login: loginRaw,
      label: label || null,
      plano_codigo: plano,
      duracao_horas: dias * 24,
      is_demo: true,
      status: "pendente",
      expira_em: new Date(Date.now() + 90 * 86400_000).toISOString(),
      criado_por: admin.id,
    })
    .select()
    .single();
  if (convErr) {
    return j(400, { error: "convite_falhou", detail: convErr.message });
  }

  return j(200, {
    ok: true,
    login: loginRaw,
    email,
    senha,
    plano,
    dias,
    convite_id: convite.id,
    user_id: created.user.id,
  });
});
