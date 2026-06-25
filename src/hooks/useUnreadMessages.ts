import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

/**
 * Conta mensagens não lidas globalmente para o usuário corrente.
 * - Conta apenas mensagens cujo remetente NÃO é o usuário (recebidas).
 * - RLS já garante que somente mensagens de conversas das quais o usuário
 *   participa são visíveis, então não precisamos joinar conversas aqui.
 * - Atualiza em tempo real via canal Realtime de `public.mensagens`.
 */
export function useUnreadMessages(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    let mounted = true;

    const refresh = async () => {
      const { count: c } = await supabase
        .from("mensagens")
        .select("id", { count: "exact", head: true })
        .eq("lida", false)
        .neq("remetente_id", user.id)
        .is("deleted_at", null);
      if (mounted) setCount(c ?? 0);
    };

    void refresh();

    const channel = supabase
      .channel(`unread-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "mensagens" },
        () => {
          void refresh();
        },
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, [user]);

  return count;
}
