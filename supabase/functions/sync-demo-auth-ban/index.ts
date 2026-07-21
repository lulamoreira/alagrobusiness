// Sincroniza o status de contas DEMO (is_demo=true) com o Auth:
// - profiles.status = 'bloqueado' => bane no Auth (ban_duration longo)
// - profiles.status = 'ativo'     => desbane (ban_duration 'none')
// Idempotente. NUNCA toca usuários com is_demo != true.
// Autorização: header x-cron-secret (conferido no Vault) OU JWT de admin.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BAN_DURATION = "876000h"; // ~100 anos
const UNBAN_DURATION = "none";

function j(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}

async function isAuthorized(req: Request): Promise<
  { ok: true; via: "cron" | "admin" } | { ok: false }
> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // (i) x-cron-secret
  const cronHdr = req.headers.get("x-cron-secret");
  if (cronHdr) {
    const { data: expected } = await service.rpc("get_cron_secret");
    if (expected && cronHdr === expected) return { ok: true, via: "cron" };
  }

  // (ii) JWT de admin
  const authHdr = req.headers.get("Authorization");
  if (authHdr) {
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const asUser = createClient(url, anon, {
      global: { headers: { Authorization: authHdr } },
    });
    const { data: userRes } = await asUser.auth.getUser();
    if (userRes?.user) {
      const { data: isAdmin } = await service.rpc("is_admin", {
        _user_id: userRes.user.id,
      });
      if (isAdmin === true) return { ok: true, via: "admin" };
    }
  }

  return { ok: false };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET")
    return j(405, { error: "method_not_allowed" });

  const auth = await isAuthorized(req);
  if (!auth.ok) return j(401, { error: "unauthorized" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Somente contas demo, não excluídas
  const { data: demos, error: qerr } = await service
    .from("profiles")
    .select("id, status, is_demo, is_super_admin, deleted_at")
    .eq("is_demo", true)
    .is("deleted_at", null);

  if (qerr) return j(500, { error: "query_failed", detail: qerr.message });

  let banidos = 0;
  let desbanidos = 0;
  const erros: Array<{ id: string; detail: string }> = [];

  for (const p of demos ?? []) {
    if (p.is_super_admin) continue; // paranoia
    if (!p.is_demo) continue; // paranoia dupla

    const shouldBan = p.status === "bloqueado";
    const shouldUnban = p.status === "ativo";
    if (!shouldBan && !shouldUnban) continue;

    // Idempotente: consulta estado atual no Auth
    const { data: current, error: gErr } = await service.auth.admin.getUserById(p.id);
    if (gErr || !current?.user) continue;

    // Supabase typing gap: banned_until existe no user row do admin API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bannedUntilRaw = (current.user as any).banned_until as string | null | undefined;
    const isCurrentlyBanned =
      !!bannedUntilRaw && new Date(bannedUntilRaw).getTime() > Date.now();

    if (shouldBan && isCurrentlyBanned) continue;
    if (shouldUnban && !isCurrentlyBanned) continue;

    const { error: uErr } = await service.auth.admin.updateUserById(p.id, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ban_duration: shouldBan ? BAN_DURATION : UNBAN_DURATION,
    } as any);

    if (uErr) {
      erros.push({ id: p.id, detail: uErr.message });
      continue;
    }
    if (shouldBan) banidos++;
    else desbanidos++;
  }

  return j(200, {
    ok: true,
    via: auth.via,
    total_demos: demos?.length ?? 0,
    banidos,
    desbanidos,
    erros,
  });
});
