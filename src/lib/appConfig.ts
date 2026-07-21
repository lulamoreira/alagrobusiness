import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DOCS_KEY = "documentos_obrigatorios";

export function useDocsObrigatorios() {
  return useQuery({
    queryKey: ["app_config", DOCS_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_config")
        .select("valor")
        .eq("chave", DOCS_KEY)
        .maybeSingle();
      if (error) throw error;
      const v = (data?.valor ?? {}) as { ativo?: boolean };
      return { ativo: Boolean(v.ativo) };
    },
    staleTime: 60_000,
  });
}

export function useSetDocsObrigatorios() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ativo: boolean) => {
      const { error } = await supabase
        .from("app_config")
        .upsert(
          { chave: DOCS_KEY, valor: { ativo } },
          { onConflict: "chave" },
        );
      if (error) throw error;
      return { ativo };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app_config", DOCS_KEY] }),
  });
}
