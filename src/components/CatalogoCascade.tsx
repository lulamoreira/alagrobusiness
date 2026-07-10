import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Lightbulb } from "lucide-react";
import {
  fetchCatalogoAll,
  catalogoAncestors,
  catalogoChildren,
  catalogoName,
  type CatalogoNode,
} from "@/lib/catalogo";
import { supabase } from "@/integrations/supabase/client";
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
      {!allowClear && (
        <SuggestCategory nodes={nodes ?? []} tipo={tipoFilter ?? "produto"} />
      )}
    </div>
  );
}

interface SuggestProps {
  nodes: CatalogoNode[];
  tipo: "produto" | "servico";
}

function SuggestCategory({ nodes, tipo }: SuggestProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [nomePt, setNomePt] = useState("");
  const [nomeEn, setNomeEn] = useState("");
  const [nomeEs, setNomeEs] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const parents = useMemo(
    () =>
      nodes.filter(
        (n) => n.parent_id === null && (n.tipo === tipo || n.tipo === "ambos"),
      ),
    [nodes, tipo],
  );

  const reset = () => {
    setNomePt("");
    setNomeEn("");
    setNomeEs("");
    setParentId(null);
  };

  const submit = async () => {
    if (!nomePt.trim()) {
      toast.error(t("catalogoSuggest.errorNamePt"));
      return;
    }
    setSaving(true);
    const nome: Record<string, string> = { pt: nomePt.trim() };
    if (nomeEn.trim()) nome.en = nomeEn.trim();
    if (nomeEs.trim()) nome.es = nomeEs.trim();
    const { error } = await supabase.rpc("sugerir_categoria", {
      p_parent_id: parentId ?? (null as unknown as string),
      p_nome: nome,
      p_tipo: tipo,
    } as never);
    setSaving(false);
    if (error) {
      toast.error(t("catalogoSuggest.errorSubmit"));
      return;
    }
    toast.success(t("catalogoSuggest.sent"));
    reset();
    setOpen(false);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
      >
        <Lightbulb className="h-3.5 w-3.5" />
        {t("catalogoSuggest.button")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur">
          <div className="w-full max-w-lg space-y-4 rounded-3xl border border-border bg-card p-6">
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">
                {t("catalogoSuggest.title")}
              </h3>
              <p className="text-xs text-muted-foreground">{t("catalogoSuggest.hint")}</p>
            </div>
            <div className="grid gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("catalogoSuggest.namePt")}
                </label>
                <input
                  value={nomePt}
                  onChange={(e) => setNomePt(e.target.value)}
                  className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("catalogoSuggest.nameEn")}
                  </label>
                  <input
                    value={nomeEn}
                    onChange={(e) => setNomeEn(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {t("catalogoSuggest.nameEs")}
                  </label>
                  <input
                    value={nomeEs}
                    onChange={(e) => setNomeEs(e.target.value)}
                    className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {t("catalogoSuggest.parent")}
                </label>
                <select
                  value={parentId ?? ""}
                  onChange={(e) => setParentId(e.target.value || null)}
                  className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option value="">{t("catalogoSuggest.parentRoot")}</option>
                  {parents.map((p) => (
                    <option key={p.id} value={p.id}>
                      {catalogoName(p.nome, i18n.language)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={saving}
                className="rounded-full border border-primary bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {saving ? t("common.loading") : t("catalogoSuggest.submit")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

