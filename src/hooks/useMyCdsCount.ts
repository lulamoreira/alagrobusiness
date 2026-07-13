import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function useMyCdsCount() {
  const { user } = useAuth();
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setCount(0);
      return;
    }
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count: c } = await (supabase as any)
        .from("cd_operadores")
        .select("id", { count: "exact", head: true })
        .eq("usuario_id", user.id);
      if (!cancelled) setCount(c ?? 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  return count;
}
