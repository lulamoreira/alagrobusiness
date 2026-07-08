// Apaga definitivamente uma conta demo (auth.users + profile + convite).
// Somente admins e SOMENTE contas com is_demo=true.
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

  let body: { convite_id?: string };
  try {
    body = await req.json();
  } catch {
    return j(400, { error: "json_invalido" });
  }
  const conviteId = (body.convite_id ?? "").trim();
  if (!conviteId) return j(400, { error: "convite_id_obrigatorio" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: conv } = await service
    .from("convites_cortesia")
    .select("id, is_demo, usado_por, email")
    .eq("id", conviteId)
    .maybeSingle();
  if (!conv || !conv.is_demo) return j(403, { error: "nao_e_demo" });

  // Descobre user_id: se convite tem usado_por, use; senão busque por email
  let userId: string | null = conv.usado_por ?? null;
  if (!userId && conv.email) {
    const { data: list } = await service.auth.admin.listUsers({ page: 1, perPage: 200 });
    userId = list?.users.find((u) => u.email?.toLowerCase() === conv.email.toLowerCase())?.id ?? null;
  }

  // Segurança extra: só apaga se o perfil também for demo (ou não existir)
  if (userId) {
    const { data: prof } = await service
      .from("profiles")
      .select("is_demo, is_super_admin")
      .eq("id", userId)
      .maybeSingle();
    if (prof?.is_super_admin) return j(403, { error: "super_admin_imutavel" });
    if (prof && !prof.is_demo) return j(403, { error: "nao_e_demo" });

    const { error: delErr } = await service.auth.admin.deleteUser(userId);
    if (delErr) return j(400, { error: "delete_falhou", detail: delErr.message });
    await service.from("profiles").delete().eq("id", userId);
  }

  // Soft-delete do convite
  await service
    .from("convites_cortesia")
    .update({ deleted_at: new Date().toISOString(), status: "cancelado" })
    .eq("id", conviteId);

  return j(200, { ok: true });
});
