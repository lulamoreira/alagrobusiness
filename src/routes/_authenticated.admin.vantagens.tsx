import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Loader2, Plus, Pencil, Trash2, Sparkles, Save, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminPerms } from "@/lib/adminPerms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/vantagens")({
  component: AdminVantagensPage,
});

interface VantagemRow {
  id: string;
  titulo: string;
  descricao: string | null;
  parceiro_nome: string;
  parceiro_logo_url: string | null;
  categoria: string | null;
  desconto: string;
  cupom: string | null;
  link_url: string | null;
  validade: string | null;
  ativo: boolean;
  ordem: number;
  created_at: string;
}

type FormState = {
  id?: string;
  titulo: string;
  descricao: string;
  parceiro_nome: string;
  parceiro_logo_url: string;
  categoria: string;
  desconto: string;
  cupom: string;
  link_url: string;
  validade: string;
  ativo: boolean;
  ordem: number;
};

const emptyForm: FormState = {
  titulo: "",
  descricao: "",
  parceiro_nome: "",
  parceiro_logo_url: "",
  categoria: "",
  desconto: "",
  cupom: "",
  link_url: "",
  validade: "",
  ativo: true,
  ordem: 0,
};

function AdminVantagensPage() {
  const { t } = useTranslation();
  const { isAdmin } = useAdminPerms();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);

  const schema = useMemo(
    () =>
      z.object({
        titulo: z.string().trim().min(2, t("adminVantagens.errors.titulo")),
        parceiro_nome: z.string().trim().min(2, t("adminVantagens.errors.parceiro")),
        desconto: z.string().trim().min(1, t("adminVantagens.errors.desconto")),
        link_url: z
          .string()
          .trim()
          .refine((v) => v === "" || /^https?:\/\//i.test(v), t("adminVantagens.errors.link")),
      }),
    [t],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "vantagens"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vantagens")
        .select(
          "id, titulo, descricao, parceiro_nome, parceiro_logo_url, categoria, desconto, cupom, link_url, validade, ativo, ordem, created_at",
        )
        .is("deleted_at", null)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as VantagemRow[];
    },
  });

  if (!isAdmin) {
    return <div className="p-6 text-sm text-muted-foreground">{t("common.not_found")}</div>;
  }

  const openNew = () => setForm({ ...emptyForm });
  const openEdit = (row: VantagemRow) =>
    setForm({
      id: row.id,
      titulo: row.titulo,
      descricao: row.descricao ?? "",
      parceiro_nome: row.parceiro_nome,
      parceiro_logo_url: row.parceiro_logo_url ?? "",
      categoria: row.categoria ?? "",
      desconto: row.desconto,
      cupom: row.cupom ?? "",
      link_url: row.link_url ?? "",
      validade: row.validade ?? "",
      ativo: row.ativo,
      ordem: row.ordem,
    });

  const save = async () => {
    if (!form) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("common.error"));
      return;
    }
    setSaving(true);
    const payload = {
      titulo: form.titulo.trim(),
      descricao: form.descricao.trim() || null,
      parceiro_nome: form.parceiro_nome.trim(),
      parceiro_logo_url: form.parceiro_logo_url.trim() || null,
      categoria: form.categoria.trim() || null,
      desconto: form.desconto.trim(),
      cupom: form.cupom.trim() || null,
      link_url: form.link_url.trim() || null,
      validade: form.validade || null,
      ativo: form.ativo,
      ordem: Number.isFinite(form.ordem) ? form.ordem : 0,
    };
    const { error } = form.id
      ? await supabase.from("vantagens").update(payload).eq("id", form.id)
      : await supabase.from("vantagens").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(t("common.error"));
      return;
    }
    toast.success(t("common.saved"));
    setForm(null);
    qc.invalidateQueries({ queryKey: ["admin", "vantagens"] });
    qc.invalidateQueries({ queryKey: ["vantagens", "clube"] });
  };

  const remove = async (id: string) => {
    if (!confirm(t("adminVantagens.confirmDelete"))) return;
    const { error } = await supabase
      .from("vantagens")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(t("common.error"));
      return;
    }
    toast.success(t("common.deleted"));
    qc.invalidateQueries({ queryKey: ["admin", "vantagens"] });
  };

  const rows = data ?? [];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">
              {t("adminVantagens.title")}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">{t("adminVantagens.subtitle")}</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> {t("adminVantagens.new")}
        </Button>
      </header>

      {form && (
        <div className="rounded-2xl border border-primary/30 bg-card/80 p-5 shadow-lg backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">
              {form.id ? t("adminVantagens.editing") : t("adminVantagens.creating")}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setForm(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("adminVantagens.fields.titulo")}>
              <Input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} />
            </Field>
            <Field label={t("adminVantagens.fields.parceiro")}>
              <Input
                value={form.parceiro_nome}
                onChange={(e) => setForm({ ...form, parceiro_nome: e.target.value })}
              />
            </Field>
            <Field label={t("adminVantagens.fields.desconto")}>
              <Input
                value={form.desconto}
                onChange={(e) => setForm({ ...form, desconto: e.target.value })}
                placeholder={t("adminVantagens.placeholders.desconto")}
              />
            </Field>
            <Field label={t("adminVantagens.fields.categoria")}>
              <Input
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              />
            </Field>
            <Field label={t("adminVantagens.fields.cupom")}>
              <Input value={form.cupom} onChange={(e) => setForm({ ...form, cupom: e.target.value })} />
            </Field>
            <Field label={t("adminVantagens.fields.link")}>
              <Input
                value={form.link_url}
                onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                placeholder="https://…"
              />
            </Field>
            <Field label={t("adminVantagens.fields.logo")}>
              <Input
                value={form.parceiro_logo_url}
                onChange={(e) => setForm({ ...form, parceiro_logo_url: e.target.value })}
                placeholder="https://…"
              />
            </Field>
            <Field label={t("adminVantagens.fields.validade")}>
              <Input
                type="date"
                value={form.validade}
                onChange={(e) => setForm({ ...form, validade: e.target.value })}
              />
            </Field>
            <Field label={t("adminVantagens.fields.ordem")}>
              <Input
                type="number"
                value={form.ordem}
                onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) || 0 })}
              />
            </Field>
            <div className="flex items-center gap-3 md:col-span-1">
              <Switch
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
                id="ativo"
              />
              <Label htmlFor="ativo">{t("adminVantagens.fields.ativo")}</Label>
            </div>
            <div className="md:col-span-2">
              <Field label={t("adminVantagens.fields.descricao")}>
                <Textarea
                  rows={3}
                  value={form.descricao}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                />
              </Field>
            </div>
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setForm(null)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {t("common.save")}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
          {t("adminVantagens.empty")}
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className={cn(
                "flex flex-wrap items-start justify-between gap-4 rounded-2xl border p-4",
                r.ativo ? "border-border bg-card/60" : "border-border bg-card/30 opacity-70",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {r.parceiro_nome}
                  </span>
                  {r.categoria && (
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                      {r.categoria}
                    </span>
                  )}
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {r.desconto}
                  </span>
                  {!r.ativo && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {t("adminVantagens.inactive")}
                    </span>
                  )}
                </div>
                <h3 className="mt-1 font-semibold text-foreground">{r.titulo}</h3>
                {r.descricao && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.descricao}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(r)} className="gap-1">
                  <Pencil className="h-3.5 w-3.5" /> {t("common.edit")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => remove(r.id)} className="gap-1">
                  <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
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
