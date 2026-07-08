// Redefine a senha de uma conta demo. Somente admins.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

  let body: { user_id?: string; senha?: string };
  try {
    body = await req.json();
  } catch {
    return j(400, { error: "json_invalido" });
  }
  const userId = (body.user_id ?? "").trim();
  const senha = (body.senha ?? "").trim();
  if (!userId) return j(400, { error: "user_id_obrigatorio" });
  if (!senha || senha.length < 6) return j(400, { error: "senha_invalida" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Só permite reset de conta marcada como demo
  const { data: prof } = await service
    .from("profiles")
    .select("is_demo")
    .eq("id", userId)
    .maybeSingle();
  if (!prof?.is_demo) return j(403, { error: "nao_e_demo" });

  const { error } = await service.auth.admin.updateUserById(userId, { password: senha });
  if (error) return j(400, { error: "reset_falhou", detail: error.message });
  return j(200, { ok: true });
});
