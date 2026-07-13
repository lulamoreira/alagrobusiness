import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, Pencil, Save, Warehouse, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { EstoquePanel } from "@/components/EstoquePanel";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/meus-cds")({
  component: MeusCdsPage,
});

interface CdRow {
  id: string;
  nome: string;
  descricao: string | null;
  responsavel: string | null;
  telefone: string | null;
  endereco: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  latitude: number | null;
  longitude: number | null;
  capacidade: string | null;
  ativo: boolean;
  aprovado: boolean;
}

type FormState = {
  descricao: string;
  responsavel: string;
  telefone: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  latitude: string;
  longitude: string;
  capacidade: string;
};

function toForm(r: CdRow): FormState {
  return {
    descricao: r.descricao ?? "",
    responsavel: r.responsavel ?? "",
    telefone: r.telefone ?? "",
    endereco: r.endereco ?? "",
    cidade: r.cidade ?? "",
    estado: r.estado ?? "",
    cep: r.cep ?? "",
    latitude: r.latitude != null ? String(r.latitude) : "",
    longitude: r.longitude != null ? String(r.longitude) : "",
    capacidade: r.capacidade ?? "",
  };
}

function MeusCdsPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const { data: myCds, isLoading } = useQuery({
    queryKey: ["meus_cds", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<CdRow[]> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: links, error } = await (supabase as any)
        .from("cd_operadores")
        .select("centro_id")
        .eq("usuario_id", user!.id);
      if (error) throw error;
      const ids = ((links ?? []) as { centro_id: string }[]).map((l) => l.centro_id);
      if (ids.length === 0) return [];
      const { data: cds, error: err2 } = await supabase
        .from("centros_distribuicao")
        .select(
          "id, nome, descricao, responsavel, telefone, endereco, cidade, estado, cep, latitude, longitude, capacidade, ativo",
        )
        .in("id", ids)
        .is("deleted_at", null)
        .order("nome", { ascending: true });
      if (err2) throw err2;
      return (cds ?? []) as CdRow[];
    },
  });

  const cdIds = useMemo(() => (myCds ?? []).map((c) => c.id), [myCds]);

  const { data: adsByCd } = useQuery({
    queryKey: ["meus_cds_ads", cdIds.join(",")],
    enabled: cdIds.length > 0,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: links } = await (supabase as any)
        .from("anuncio_centros")
        .select("anuncio_id, centro_id")
        .in("centro_id", cdIds);
      const rows = (links ?? []) as { anuncio_id: string; centro_id: string }[];
      const anuncioIds = Array.from(new Set(rows.map((r) => r.anuncio_id)));
      if (anuncioIds.length === 0) return { byCd: new Map<string, AdRow[]>(), total: 0 };
      const { data: ads } = await supabase
        .from("anuncios")
        .select("id, titulo, produto, status, vendedor_id, quantidade_unidade_id")
        .in("id", anuncioIds)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
      const vendorIds = Array.from(
        new Set(((ads ?? []) as { vendedor_id: string }[]).map((a) => a.vendedor_id)),
      );
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, nome_completo")
        .in("id", vendorIds);
      const vendorMap = new Map(
        (profs ?? []).map((p) => [
          (p as { id: string }).id,
          (p as { id: string; nome_completo: string | null }).nome_completo,
        ]),
      );
      const adMap = new Map<string, AdRow>(
        ((ads ?? []) as AdRow[]).map((a) => [
          a.id,
          { ...a, vendedor_nome: vendorMap.get(a.vendedor_id) ?? null },
        ]),
      );
      const byCd = new Map<string, AdRow[]>();
      for (const link of rows) {
        const ad = adMap.get(link.anuncio_id);
        if (!ad) continue;
        const cur = byCd.get(link.centro_id) ?? [];
        cur.push(ad);
        byCd.set(link.centro_id, cur);
      }
      return { byCd, total: adMap.size };
    },
  });

  const { data: unidades } = useQuery({
    queryKey: ["unidades_all"],
    queryFn: async () =>
      (await supabase.from("unidades").select("id, nome_chave").is("deleted_at", null)).data ?? [],
    staleTime: 1000 * 60 * 30,
  });
  const unitMap = useMemo(
    () => new Map((unidades ?? []).map((u) => [u.id, u.nome_chave])),
    [unidades],
  );
  const [expandedEstoque, setExpandedEstoque] = useState<Set<string>>(new Set());
  const toggleEstoque = (key: string) =>
    setExpandedEstoque((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const startEdit = (cd: CdRow) => {
    setEditingId(cd.id);
    setForm(toForm(cd));
  };

  const save = async () => {
    if (!editingId || !form) return;
    setSaving(true);
    const payload = {
      descricao: form.descricao.trim() || null,
      responsavel: form.responsavel.trim() || null,
      telefone: form.telefone.trim() || null,
      endereco: form.endereco.trim() || null,
      cidade: form.cidade.trim() || null,
      estado: form.estado.trim() || null,
      cep: form.cep.trim() || null,
      latitude: form.latitude.trim() ? Number(form.latitude) : null,
      longitude: form.longitude.trim() ? Number(form.longitude) : null,
      capacidade: form.capacidade.trim() || null,
    };
    const { error } = await supabase
      .from("centros_distribuicao")
      .update(payload)
      .eq("id", editingId);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("meusCds.saved"));
    setEditingId(null);
    setForm(null);
    qc.invalidateQueries({ queryKey: ["meus_cds", user?.id] });
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <header>
        <div className="flex items-center gap-2">
          <Warehouse className="h-5 w-5 text-primary" />
          <h1 className="font-display text-2xl font-bold text-foreground">
            {t("meusCds.title")}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">{t("meusCds.subtitle")}</p>
      </header>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (myCds ?? []).length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
          {t("meusCds.empty")}
        </div>
      ) : (
        <ul className="space-y-4">
          {(myCds ?? []).map((cd) => {
            const isEditing = editingId === cd.id;
            const ads = adsByCd?.byCd.get(cd.id) ?? [];
            return (
              <li key={cd.id} className="rounded-2xl border border-border bg-card/60 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-lg font-semibold text-foreground">{cd.nome}</h2>
                    <p className="text-xs text-muted-foreground">
                      {[cd.cidade, cd.estado].filter(Boolean).join(" / ") || "—"}
                    </p>
                  </div>
                  {!isEditing ? (
                    <Button variant="outline" size="sm" onClick={() => startEdit(cd)} className="gap-1">
                      <Pencil className="h-3.5 w-3.5" /> {t("meusCds.edit")}
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setEditingId(null); setForm(null); }} className="gap-1">
                        <X className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" onClick={save} disabled={saving} className="gap-1">
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                        {t("common.save")}
                      </Button>
                    </div>
                  )}
                </div>

                {isEditing && form && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Field label={t("adminCds.fields.responsavel")}>
                      <Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
                    </Field>
                    <Field label={t("adminCds.fields.telefone")}>
                      <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label={t("adminCds.fields.endereco")}>
                        <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
                      </Field>
                    </div>
                    <Field label={t("adminCds.fields.cidade")}>
                      <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
                    </Field>
                    <Field label={t("adminCds.fields.estado")}>
                      <Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} />
                    </Field>
                    <Field label={t("adminCds.fields.cep")}>
                      <Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} />
                    </Field>
                    <Field label={t("adminCds.fields.capacidade")}>
                      <Input value={form.capacidade} onChange={(e) => setForm({ ...form, capacidade: e.target.value })} />
                    </Field>
                    <Field label={t("adminCds.fields.latitude")}>
                      <Input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
                    </Field>
                    <Field label={t("adminCds.fields.longitude")}>
                      <Input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
                    </Field>
                    <div className="md:col-span-2">
                      <Field label={t("adminCds.fields.descricao")}>
                        <Textarea rows={3} value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
                      </Field>
                    </div>
                  </div>
                )}

                <div className="mt-5 border-t border-border pt-4">
                  <h3 className="mb-2 text-sm font-semibold text-foreground">
                    {t("meusCds.linkedAds")} ({ads.length})
                  </h3>
                  {ads.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t("meusCds.noAds")}</p>
                  ) : (
                    <ul className="space-y-2">
                      {ads.map((a) => {
                        const key = `${cd.id}:${a.id}`;
                        const open = expandedEstoque.has(key);
                        return (
                          <li key={a.id} className="rounded-lg border border-border bg-background/40 px-3 py-2 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{a.titulo}</p>
                                <p className="truncate text-xs text-muted-foreground">
                                  {t("meusCds.product")}: {a.produto} · {t("meusCds.seller")}: {a.vendedor_nome ?? "—"} · {t("meusCds.status")}: {a.status}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => toggleEstoque(key)}
                                  className="gap-1"
                                >
                                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
                                  {t("estoque.title")}
                                </Button>
                                <Link
                                  to="/anuncio/$id"
                                  params={{ id: a.id }}
                                  className="text-xs font-medium text-primary hover:underline"
                                >
                                  {t("meusCds.openAd")}
                                </Link>
                              </div>
                            </div>
                            {open && (
                              <div className="mt-3">
                                <EstoquePanel
                                  anuncioId={a.id}
                                  centroId={cd.id}
                                  unidadeChave={a.quantidade_unidade_id ? unitMap.get(a.quantidade_unidade_id) : null}
                                />
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

interface AdRow {
  id: string;
  titulo: string;
  produto: string;
  status: string;
  vendedor_id: string;
  quantidade_unidade_id: string | null;
  vendedor_nome?: string | null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
