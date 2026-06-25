import { supabase } from "@/integrations/supabase/client";

/**
 * Encontra a conversa ativa entre `userId` (comprador) e o vendedor do anúncio,
 * ou cria uma nova. Retorna o id da conversa.
 *
 * Regras de banco aplicadas:
 * - Índice único parcial (anuncio_id, comprador_id) WHERE deleted_at IS NULL.
 * - Policy de INSERT só aceita auth.uid() = comprador_id e vendedor_id confere
 *   com o dono do anúncio.
 */
export async function getOrCreateConversation(params: {
  anuncioId: string;
  vendedorId: string;
  userId: string;
}): Promise<string> {
  const { anuncioId, vendedorId, userId } = params;

  if (userId === vendedorId) {
    throw new Error("OWNER_CANNOT_CHAT_SELF");
  }

  const { data: existing, error: selErr } = await supabase
    .from("conversas")
    .select("id")
    .eq("anuncio_id", anuncioId)
    .eq("comprador_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing?.id) return existing.id;

  const { data: created, error: insErr } = await supabase
    .from("conversas")
    .insert({
      anuncio_id: anuncioId,
      comprador_id: userId,
      vendedor_id: vendedorId,
    })
    .select("id")
    .single();

  if (insErr) throw insErr;
  return created.id;
}
