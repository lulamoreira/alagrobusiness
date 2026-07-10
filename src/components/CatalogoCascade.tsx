import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import {
  fetchCatalogoAll,
  catalogoAncestors,
  catalogoChildren,
  catalogoName,
  type CatalogoNode,
} from "@/lib/catalogo";
import { cn } from "@/lib/utils";

interface CatalogoCascadeProps {
  /** Currently selected leaf-most id. */
  value: string | null;
  onChange: (id: string | null) => void;
  /** Optional label rendered above the selects. */
  label?: string;
  /** When true, shows an "All" chip on the first level (for filters). */
  allowClear?: boolean;
  /** Filter root categories by type. When set, roots must match tipoFilter or 'ambos'. */
  tipoFilter?: "produto" | "servico";
  className?: string;
}

/**
 * Cascading selector for the hierarchical category catalog.
 * Renders one <select> per depth level up to the deepest chosen node.
 * The saved value is always the deepest node the user picked.
 */
export function CatalogoCascade({
  value,
  onChange,
  label,
  allowClear = false,
  tipoFilter,
  className,
}: CatalogoCascadeProps) {
  const { t, i18n } = useTranslation();

  const { data: nodes } = useQuery({
    queryKey: ["catalogo_all_active"],
    queryFn: () => fetchCatalogoAll(false),
    staleTime: 1000 * 60 * 10,
  });

  const path = useMemo<CatalogoNode[]>(
    () => (nodes ? catalogoAncestors(nodes, value) : []),
    [nodes, value],
  );

  const levels = useMemo<{ parentId: string | null; children: CatalogoNode[]; selectedId: string | null }[]>(() => {
    if (!nodes) return [];
    const out: { parentId: string | null; children: CatalogoNode[]; selectedId: string | null }[] = [];
    let parentId: string | null = null;
    for (let depth = 0; depth < 8; depth++) {
      let children = catalogoChildren(nodes, parentId);
      if (depth === 0 && tipoFilter) {
        children = children.filter((c) => c.tipo === tipoFilter || c.tipo === "ambos");
      }
      if (children.length === 0) break;
      const selected = path[depth]?.id ?? null;
      out.push({ parentId, children, selectedId: selected });
      if (!selected) break;
      parentId = selected;
    }
    return out;
  }, [nodes, path, tipoFilter]);

  const handleChange = (depth: number, id: string) => {
    if (!id) {
      // Cleared this level → parent becomes deepest
      const parent = depth === 0 ? null : path[depth - 1]?.id ?? null;
      onChange(parent);
      return;
    }
    onChange(id);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="block text-xs font-medium text-muted-foreground">{label}</label>
      )}
      <div className="flex flex-wrap gap-2">
        {levels.map((lvl, depth) => (
          <select
            key={depth}
            value={lvl.selectedId ?? ""}
            onChange={(e) => handleChange(depth, e.target.value)}
            className="rounded-2xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
          >
            <option value="">
              {depth === 0
                ? allowClear
                  ? t("common.all")
                  : t("catalogo.selectRoot")
                : t("catalogo.selectSub")}
            </option>
            {lvl.children.map((n) => (
              <option key={n.id} value={n.id}>
                {catalogoName(n.nome, i18n.language)}
              </option>
            ))}
          </select>
        ))}
        {allowClear && value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="rounded-2xl border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            {t("common.remove")}
          </button>
        )}
      </div>
    </div>
  );
}
