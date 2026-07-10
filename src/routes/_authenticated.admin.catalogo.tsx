import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ChevronDown, ChevronRight, FolderTree, Pencil, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PillButton } from "@/components/PillButton";
import { DarkInput } from "@/components/DarkInput";
import { cn } from "@/lib/utils";
import {
  fetchCatalogoAll,
  catalogoChildren,
  catalogoName,
  type CatalogoNode,
} from "@/lib/catalogo";

export const Route = createFileRoute("/_authenticated/admin/catalogo")({
  component: AdminCatalogoPage,
});

interface EditorState {
  open: boolean;
  mode: "create" | "edit";
  parentId: string | null;
  node: CatalogoNode | null;
}

function AdminCatalogoPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const isAdmin = profile?.tipo_perfil === "admin";
  const qc = useQueryClient();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editor, setEditor] = useState<EditorState>({
    open: false,
    mode: "create",
    parentId: null,
    node: null,
  });

  const { data: nodes, isLoading, refetch } = useQuery({
    queryKey: ["catalogo_admin_all"],
    queryFn: () => fetchCatalogoAll(true),
    enabled: isAdmin,
  });

  const roots = useMemo(() => (nodes ? catalogoChildren(nodes, null) : []), [nodes]);

  const toggle = (id: string) => setExpanded((s) => ({ ...s, [id]: !s[id] }));

  const onSaved = async () => {
    await qc.invalidateQueries({ queryKey: ["catalogo_admin_all"] });
    await qc.invalidateQueries({ queryKey: ["catalogo_all_active"] });
    await refetch();
  };

  const handleDelete = async (node: CatalogoNode) => {
    if (!confirm(t("adminCatalogo.confirmDelete", { name: catalogoName(node.nome, "pt") }))) return;
    const { error } = await supabase.rpc("admin_catalogo_delete", { p_id: node.id });
    if (error) {
      toast.error(t("adminCatalogo.errorDelete"));
      return;
    }
    toast.success(t("adminCatalogo.deleted"));
    void onSaved();
  };

  if (!isAdmin) {
    return <p className="text-sm text-muted-foreground">{t("common.error")}</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 font-display text-2xl font-bold md:text-3xl">
            <FolderTree className="h-6 w-6 text-primary" />
            {t("adminCatalogo.title")}
          </h1>
          <p className="text-xs text-muted-foreground">{t("adminCatalogo.subtitle")}</p>
        </div>
        <PillButton
          type="button"
          onClick={() => setEditor({ open: true, mode: "create", parentId: null, node: null })}
        >
          <Plus className="h-4 w-4" /> {t("adminCatalogo.newRoot")}
        </PillButton>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : roots.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">{t("adminCatalogo.empty")}</p>
        </div>
      ) : (
        <div className="space-y-2 rounded-2xl border border-border bg-card/40 p-3">
          {roots.map((n) => (
            <TreeNode
              key={n.id}
              node={n}
              depth={0}
              nodes={nodes ?? []}
              expanded={expanded}
              onToggle={toggle}
              onAdd={(parentId) => setEditor({ open: true, mode: "create", parentId, node: null })}
              onEdit={(node) =>
                setEditor({ open: true, mode: "edit", parentId: node.parent_id, node })
              }
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <PendingSuggestions onChanged={onSaved} />

      {editor.open && (
        <EditorModal
          state={editor}
          nodes={nodes ?? []}
          onClose={() => setEditor((s) => ({ ...s, open: false }))}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

interface TreeNodeProps {
  node: CatalogoNode;
  depth: number;
  nodes: CatalogoNode[];
  expanded: Record<string, boolean>;
  onToggle: (id: string) => void;
  onAdd: (parentId: string) => void;
  onEdit: (node: CatalogoNode) => void;
  onDelete: (node: CatalogoNode) => void;
}

function TreeNode({ node, depth, nodes, expanded, onToggle, onAdd, onEdit, onDelete }: TreeNodeProps) {
  const { t, i18n } = useTranslation();
  const children = catalogoChildren(nodes, node.id);
  const hasChildren = children.length > 0;
  const isOpen = expanded[node.id];

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-transparent px-2 py-2 transition hover:border-border hover:bg-accent/40",
          !node.ativo && "opacity-60",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <button
          type="button"
          onClick={() => onToggle(node.id)}
          className="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          aria-label={isOpen ? t("common.back") : t("common.continue")}
        >
          {hasChildren ? (
            isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            <span className="h-2 w-2 rounded-full bg-border" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {catalogoName(node.nome, i18n.language)}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            pt: {node.nome.pt} · en: {node.nome.en ?? "—"} · es: {node.nome.es ?? "—"} · #{node.ordem}
            {!node.ativo && ` · ${t("adminCatalogo.inactive")}`}
          </p>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            title={t("adminCatalogo.addChild")}
            onClick={() => onAdd(node.id)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            title={t("common.edit")}
            onClick={() => onEdit(node)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            title={t("common.delete")}
            onClick={() => onDelete(node)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {hasChildren && isOpen && (
        <div className="space-y-1">
          {children.map((c) => (
            <TreeNode
              key={c.id}
              node={c}
              depth={depth + 1}
              nodes={nodes}
              expanded={expanded}
              onToggle={onToggle}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface EditorModalProps {
  state: EditorState;
  nodes: CatalogoNode[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

function EditorModal({ state, nodes, onClose, onSaved }: EditorModalProps) {
  const { t } = useTranslation();
  const initial = state.node;
  const [nomePt, setNomePt] = useState(initial?.nome.pt ?? "");
  const [nomeEn, setNomeEn] = useState(initial?.nome.en ?? "");
  const [nomeEs, setNomeEs] = useState(initial?.nome.es ?? "");
  const [ordem, setOrdem] = useState<string>(String(initial?.ordem ?? 0));
  const [ativo, setAtivo] = useState<boolean>(initial?.ativo ?? true);
  const [icone, setIcone] = useState<string>(initial?.icone ?? "");
  const [parentId, setParentId] = useState<string | null>(
    initial ? initial.parent_id : state.parentId,
  );
  const [tipo, setTipo] = useState<"produto" | "servico" | "ambos">(
    (initial?.tipo as "produto" | "servico" | "ambos" | undefined) ?? "produto",
  );
  const [segmento, setSegmento] = useState<"agro" | "industrial">(
    (initial?.segmento as "agro" | "industrial" | null | undefined) ?? "agro",
  );
  const [saving, setSaving] = useState(false);
  const isRoot = parentId === null;
  const showSegmento = isRoot && tipo === "produto";


  const parentOptions = useMemo(() => {
    // Prevent selecting itself or its descendants as parent
    if (!initial) return nodes;
    const banned = new Set<string>([initial.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of nodes) {
        if (n.parent_id && banned.has(n.parent_id) && !banned.has(n.id)) {
          banned.add(n.id);
          changed = true;
        }
      }
    }
    return nodes.filter((n) => !banned.has(n.id));
  }, [nodes, initial]);

  const save = async () => {
    if (!nomePt.trim()) {
      toast.error(t("adminCatalogo.errorNomePt"));
      return;
    }
    setSaving(true);
    const nome: Record<string, string> = { pt: nomePt.trim() };
    if (nomeEn.trim()) nome.en = nomeEn.trim();
    if (nomeEs.trim()) nome.es = nomeEs.trim();

    const { error } = await supabase.rpc("admin_catalogo_upsert", {
      p_id: initial?.id ?? (null as unknown as string),
      p_parent_id: parentId ?? (null as unknown as string),
      p_nome: nome,
      p_ordem: Number(ordem) || 0,
      p_ativo: ativo,
      p_icone: icone.trim() || (null as unknown as string),
      p_tipo: tipo,
      p_segmento: showSegmento ? segmento : (null as unknown as string),
    } as never);


    setSaving(false);
    if (error) {
      toast.error(t("adminCatalogo.errorSave"));
      return;
    }
    toast.success(t("adminCatalogo.saved"));
    await onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 p-4 backdrop-blur">
      <div className="w-full max-w-lg space-y-4 rounded-3xl border border-border bg-card p-6">
        <div>
          <h2 className="font-display text-lg font-bold text-foreground">
            {state.mode === "create" ? t("adminCatalogo.createTitle") : t("adminCatalogo.editTitle")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("adminCatalogo.editorHint")}</p>
        </div>

        <div className="grid gap-3">
          <DarkInput
            label={`${t("adminCatalogo.namePt")} *`}
            value={nomePt}
            onChange={(e) => setNomePt(e.target.value)}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <DarkInput
              label={t("adminCatalogo.nameEn")}
              value={nomeEn}
              onChange={(e) => setNomeEn(e.target.value)}
            />
            <DarkInput
              label={t("adminCatalogo.nameEs")}
              value={nomeEs}
              onChange={(e) => setNomeEs(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {t("adminCatalogo.parent")}
            </label>
            <select
              value={parentId ?? ""}
              onChange={(e) => setParentId(e.target.value || null)}
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="">{t("adminCatalogo.parentRoot")}</option>
              {parentOptions.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nome.pt}
                </option>
              ))}
            </select>
          </div>

          {isRoot && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {t("adminCatalogo.tipo")}
              </label>
              <div className="flex flex-wrap gap-2">
                {(["produto", "servico", "ambos"] as const).map((tp) => (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => setTipo(tp)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                      tipo === tp
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t(`adminCatalogo.tipo_${tp}`)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showSegmento && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                {t("adminCatalogo.segmento")}
              </label>
              <div className="flex flex-wrap gap-2">
                {(["agro", "industrial"] as const).map((sg) => (
                  <button
                    key={sg}
                    type="button"
                    onClick={() => setSegmento(sg)}
                    className={cn(
                      "rounded-full border px-4 py-2 text-sm font-medium transition-all",
                      segmento === sg
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {t(`adminCatalogo.segmento_${sg}`)}
                  </button>
                ))}
              </div>
            </div>
          )}




          <div className="grid gap-3 md:grid-cols-3">
            <DarkInput
              label={t("adminCatalogo.order")}
              type="number"
              value={ordem}
              onChange={(e) => setOrdem(e.target.value)}
            />
            <DarkInput
              label={t("adminCatalogo.icon")}
              value={icone}
              onChange={(e) => setIcone(e.target.value)}
              placeholder="🌾"
            />
            <label className="flex items-center gap-2 self-end pb-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={ativo}
                onChange={(e) => setAtivo(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              {t("adminCatalogo.active")}
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <PillButton type="button" variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </PillButton>
          <PillButton type="button" onClick={save} disabled={saving}>
            {saving ? t("common.loading") : t("common.save")}
          </PillButton>
        </div>
      </div>
    </div>
  );
}

interface PendingRow {
  id: string;
  nome: Record<string, string>;
  tipo: string;
  parent_id: string | null;
  parent_nome: Record<string, string> | null;
  sugerido_por: string | null;
  sugerido_por_nome: string | null;
  sugerido_por_email: string | null;
  sugerido_em: string | null;
}

function PendingSuggestions({ onChanged }: { onChanged: () => void | Promise<void> }) {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["catalogo_pendentes"],
    queryFn: async (): Promise<PendingRow[]> => {
      const { data, error } = await supabase.rpc("admin_list_categorias_pendentes" as never);
      if (error) throw error;
      return (data ?? []) as PendingRow[];
    },
  });

  const act = async (id: string, action: "aprovar" | "rejeitar") => {
    const rpc = action === "aprovar" ? "admin_categoria_aprovar" : "admin_categoria_rejeitar";
    const { error } = await supabase.rpc(rpc as never, { p_id: id } as never);
    if (error) {
      toast.error(t("adminCatalogo.errorAction"));
      return;
    }
    toast.success(
      action === "aprovar" ? t("adminCatalogo.approved") : t("adminCatalogo.rejected"),
    );
    await refetch();
    await qc.invalidateQueries({ queryKey: ["catalogo_admin_all"] });
    await qc.invalidateQueries({ queryKey: ["catalogo_all_active"] });
    await onChanged();
  };

  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-border bg-card/40 p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">{t("adminCatalogo.pendingTitle")}</p>
          <span className="rounded-full border border-border bg-card px-2 py-0.5 text-xs text-muted-foreground">
            {t("adminCatalogo.tab")}
          </span>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("adminCatalogo.empty")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {catalogoName(row.nome, i18n.language)}
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {row.parent_nome
                      ? `${t("adminCatalogo.underRoot")} ${catalogoName(row.parent_nome, i18n.language)}`
                      : t("adminCatalogo.topLevel")}
                    {" · "}
                    {row.tipo}
                    {" · "}
                    {t("adminCatalogo.suggestedBy")}: {row.sugerido_por_nome || row.sugerido_por_email || "—"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => act(row.id, "aprovar")}
                    className="rounded-full border border-primary bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                  >
                    {t("adminCatalogo.approve")}
                  </button>
                  <button
                    type="button"
                    onClick={() => act(row.id, "rejeitar")}
                    className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive"
                  >
                    {t("adminCatalogo.reject")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

