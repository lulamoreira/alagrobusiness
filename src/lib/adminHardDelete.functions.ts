import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const adminHardDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { userId: string }) => {
    if (!data?.userId || typeof data.userId !== "string") {
      throw new Error("userId_obrigatorio");
    }
    return data;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;

    // Não pode excluir a si mesmo
    if (data.userId === callerId) {
      throw new Error("nao_pode_excluir_a_si_mesmo");
    }

    // Verifica permissão 'acessos' do chamador
    const { data: hasPerm, error: permErr } = await supabase.rpc("has_admin_perm", {
      _uid: callerId,
      _perm: "acessos",
    } as never);
    if (permErr) throw new Error(permErr.message);
    if (!hasPerm) throw new Error("nao_autorizado");

    // Verifica se alvo é super-admin (imutável)
    const { data: alvo, error: alvoErr } = await supabase
      .from("profiles")
      .select("is_super_admin")
      .eq("id", data.userId)
      .maybeSingle();
    if (alvoErr) throw new Error(alvoErr.message);
    if (alvo?.is_super_admin) throw new Error("super_admin_imutavel");

    // Admin client server-only para deletar de auth.users
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (delErr) throw new Error(delErr.message);

    // Best-effort cleanup — profiles/assinaturas geralmente possuem FK ON DELETE CASCADE
    // vinculada a auth.users(id). Rodamos DELETE explícito por segurança.
    await supabaseAdmin.from("profiles").delete().eq("id", data.userId);

    return { ok: true };
  });
