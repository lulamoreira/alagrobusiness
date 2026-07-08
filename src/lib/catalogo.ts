import { supabase } from "@/integrations/supabase/client";

export interface CatalogoNode {
  id: string;
  parent_id: string | null;
  nome: Record<string, string>;
  ordem: number;
  ativo: boolean;
  icone: string | null;
}

export type CatalogoLocale = "pt" | "en" | "es";

const LOCALE_MAP: Record<string, CatalogoLocale> = {
  "pt-BR": "pt",
  pt: "pt",
  en: "en",
  "en-US": "en",
  es: "es",
  "es-ES": "es",
};

export function toCatalogoLocale(lang: string): CatalogoLocale {
  return LOCALE_MAP[lang] ?? "pt";
}

export function catalogoName(
  nome: Record<string, string> | null | undefined,
  lang: string,
): string {
  if (!nome) return "";
  const loc = toCatalogoLocale(lang);
  return nome[loc] || nome.pt || nome.en || nome.es || "";
}

/**
 * Paginated fetch of the full catalog tree.
 * Uses count=exact + stable ordering to safely walk past 1000 rows.
 */
export async function fetchCatalogoAll(includeInactive = false): Promise<CatalogoNode[]> {
  const pageSize = 1000;
  let offset = 0;
  const all: CatalogoNode[] = [];
  let total = Infinity;

  while (offset < total) {
    let query = supabase
      .from("categorias_catalogo")
      .select("id, parent_id, nome, ordem, ativo, icone", { count: "exact" })
      .is("deleted_at", null)
      .order("parent_id", { ascending: true, nullsFirst: true })
      .order("ordem", { ascending: true })
      .order("id", { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (!includeInactive) query = query.eq("ativo", true);

    const { data, count, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as unknown as CatalogoNode[];
    all.push(...rows);
    total = count ?? all.length;
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}

export function catalogoChildren(nodes: CatalogoNode[], parentId: string | null): CatalogoNode[] {
  return nodes.filter((n) => (n.parent_id ?? null) === parentId);
}

export function catalogoById(nodes: CatalogoNode[], id: string | null | undefined): CatalogoNode | null {
  if (!id) return null;
  return nodes.find((n) => n.id === id) ?? null;
}

export function catalogoAncestors(nodes: CatalogoNode[], id: string | null | undefined): CatalogoNode[] {
  const path: CatalogoNode[] = [];
  let cur = catalogoById(nodes, id);
  const seen = new Set<string>();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    cur = catalogoById(nodes, cur.parent_id);
  }
  return path;
}

export function catalogoPathLabel(
  nodes: CatalogoNode[],
  id: string | null | undefined,
  lang: string,
): string {
  return catalogoAncestors(nodes, id)
    .map((n) => catalogoName(n.nome, lang))
    .join(" › ");
}

/** IDs of the whole subtree rooted at `id`, inclusive. */
export function catalogoSubtreeIds(nodes: CatalogoNode[], id: string): string[] {
  const acc: string[] = [];
  const stack = [id];
  while (stack.length) {
    const cur = stack.pop()!;
    acc.push(cur);
    for (const child of catalogoChildren(nodes, cur)) stack.push(child.id);
  }
  return acc;
}
