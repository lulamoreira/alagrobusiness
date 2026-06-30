import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CatalogItem {
  id: string;
  codigo: string;
  nome: Record<string, string>;
  unidade_padrao_id: string;
  ativo: boolean;
  ordem: number;
}

export function nomeFor(item: Pick<CatalogItem, "nome" | "codigo">, lang: string): string {
  const map = item.nome ?? {};
  return (
    map[lang] ||
    map[lang.split("-")[0]] ||
    map["pt-BR"] ||
    map["en"] ||
    map["es"] ||
    item.codigo
  );
}

/** Lê o catálogo de commodities. Admin vê todos; demais usuários só ativos (via RLS). */
export function useCommoditiesCatalog() {
  return useQuery({
    queryKey: ["commodities_catalogo"],
    queryFn: async (): Promise<CatalogItem[]> => {
      const { data, error } = await supabase
        .from("commodities_catalogo")
        .select("id, codigo, nome, unidade_padrao_id, ativo, ordem")
        .is("deleted_at", null)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id as string,
        codigo: r.codigo as string,
        nome: (r.nome ?? {}) as Record<string, string>,
        unidade_padrao_id: r.unidade_padrao_id as string,
        ativo: r.ativo as boolean,
        ordem: r.ordem as number,
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
}

export interface UserQuotePrefs {
  cotacoes_selecionadas: string[];
  tipos_dolar_visiveis: string[];
}

export function useQuotePreferences(usuarioId: string | undefined) {
  return useQuery({
    queryKey: ["preferencias_cotacoes", usuarioId],
    enabled: !!usuarioId,
    queryFn: async (): Promise<UserQuotePrefs> => {
      const { data } = await supabase
        .from("preferencias")
        .select("cotacoes_selecionadas, tipos_dolar_visiveis")
        .eq("usuario_id", usuarioId!)
        .maybeSingle();
      return {
        cotacoes_selecionadas: (data?.cotacoes_selecionadas ?? []) as string[],
        tipos_dolar_visiveis: (data?.tipos_dolar_visiveis ?? []) as string[],
      };
    },
  });
}
