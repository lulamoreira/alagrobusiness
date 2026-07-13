import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Loader2, Plus, Pencil, Trash2, Warehouse, Save, X, Power, Users, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAdminPerms } from "@/lib/adminPerms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { CdOperadoresDialog } from "@/components/CdOperadoresDialog";
import { geocodeCep } from "@/lib/geocode";

export const Route = createFileRoute("/_authenticated/admin/cds")({
  component: AdminCdsPage,
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
  created_at: string;
}

type FormState = {
  id?: string;
  nome: string;
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
  ativo: boolean;
};

const emptyForm: FormState = {
  nome: "",
  descricao: "",
  responsavel: "",
  telefone: "",
  endereco: "",
  cidade: "",
  estado: "",
  cep: "",
  latitude: "",
  longitude: "",
  capacidade: "",
  ativo: true,
};

function AdminCdsPage() {
  const { t } = useTranslation();
  const { isAdmin } = useAdminPerms();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [coordsLocked, setCoordsLocked] = useState(true);
  const [geoInfo, setGeoInfo] = useState<string | null>(null);
  const [operadoresFor, setOperadoresFor] = useState<{ id: string; nome: string } | null>(null);

  const handleCepBlur = async () => {
    if (!form) return;
    const digits = (form.cep || "").replace(/\D+/g, "");
    if (digits.length !== 8) return;
    const geo = await geocodeCep(digits);
    if (!geo) {
      setGeoInfo(t("geo.notFound"));
      return;
    }
    setForm((f) =>
      f
        ? {
            ...f,
            endereco: f.endereco || geo.logradouro || "",
            cidade: geo.cidade ?? f.cidade,
            estado: geo.estado ?? f.estado,
            latitude: geo.latitude != null ? String(geo.latitude) : f.latitude,
            longitude: geo.longitude != null ? String(geo.longitude) : f.longitude,
          }
        : f,
    );
    setCoordsLocked(true);
    if (geo.latitude != null && geo.longitude != null) {
      setGeoInfo(t("geo.detected", { cidade: geo.cidade ?? "—", estado: geo.estado ?? "—" }));
    } else {
      setGeoInfo(t("geo.noCoords"));
    }
  };

  const schema = useMemo(
    () =>
      z.object({
        nome: z.string().trim().min(2, t("adminCds.errors.nome")),
        latitude: z
          .string()
          .trim()
          .refine((v) => v === "" || !Number.isNaN(Number(v)), t("adminCds.errors.coord")),
        longitude: z
          .string()
          .trim()
          .refine((v) => v === "" || !Number.isNaN(Number(v)), t("adminCds.errors.coord")),
      }),
    [t],
  );

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "cds"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("centros_distribuicao")
        .select(
          "id, nome, descricao, responsavel, telefone, endereco, cidade, estado, cep, latitude, longitude, capacidade, ativo, aprovado, created_at",
        )
        .is("deleted_at", null)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CdRow[];
    },
  });

  if (!isAdmin) {
    return <div className="p-6 text-sm text-muted-foreground">{t("common.not_found")}</div>;
  }

  const openNew = () => {
    setGeoInfo(null);
    setCoordsLocked(true);
    setForm({ ...emptyForm });
  };
  const openEdit = (r: CdRow) => {
    setGeoInfo(null);
    setCoordsLocked(r.latitude != null && r.longitude != null);
    setForm({
      id: r.id,
      nome: r.nome,
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
      ativo: r.ativo,
    });
  };

  const save = async () => {
    if (!form) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("common.error"));
      return;
    }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
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
      ativo: form.ativo,
    };
    const { error } = form.id
      ? await supabase.from("centros_distribuicao").update(payload).eq("id", form.id)
      : await supabase.from("centros_distribuicao").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(t("common.error"));
      return;
    }
    toast.success(t("common.saved"));
    setForm(null);
    qc.invalidateQueries({ queryKey: ["admin", "cds"] });
  };

  const toggleAtivo = async (r: CdRow) => {
    const { error } = await supabase
      .from("centros_distribuicao")
      .update({ ativo: !r.ativo })
      .eq("id", r.id);
    if (error) {
      toast.error(t("common.error"));
      return;
    }
    toast.success(t("common.saved"));
    qc.invalidateQueries({ queryKey: ["admin", "cds"] });
  };

  const remove = async (id: string) => {
    if (!confirm(t("adminCds.confirmDelete"))) return;
    const { error } = await supabase
      .from("centros_distribuicao")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(t("common.error"));
      return;
    }
    toast.success(t("common.deleted"));
    qc.invalidateQueries({ queryKey: ["admin", "cds"] });
  };

  const aprovar = async (id: string) => {
    const { error } = await supabase
      .from("centros_distribuicao")
      .update({ aprovado: true })
      .eq("id", id);
    if (error) {
      toast.error(t("common.error"));
      return;
    }
    toast.success(t("adminCds.approved"));
    qc.invalidateQueries({ queryKey: ["admin", "cds"] });
  };

  const recusar = async (id: string) => {
    if (!confirm(t("adminCds.confirmReject"))) return;
    const { error } = await supabase
      .from("centros_distribuicao")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast.error(t("common.error"));
      return;
    }
    toast.success(t("adminCds.rejected"));
    qc.invalidateQueries({ queryKey: ["admin", "cds"] });
  };

  const rows = data ?? [];
  const pendingRows = rows.filter((r) => !r.aprovado);
  const approvedRows = rows.filter((r) => r.aprovado);


  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-primary" />
            <h1 className="font-display text-2xl font-bold text-foreground">
              {t("adminCds.title")}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">{t("adminCds.subtitle")}</p>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> {t("adminCds.new")}
        </Button>
      </header>

      {form && (
        <div className="rounded-2xl border border-primary/30 bg-card/80 p-5 shadow-lg backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">
              {form.id ? t("adminCds.editing") : t("adminCds.creating")}
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setForm(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("adminCds.fields.nome")}>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </Field>
            <Field label={t("adminCds.fields.responsavel")}>
              <Input
                value={form.responsavel}
                onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
              />
            </Field>
            <Field label={t("adminCds.fields.telefone")}>
              <Input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
              />
            </Field>
            <Field label={t("adminCds.fields.capacidade")}>
              <Input
                value={form.capacidade}
                onChange={(e) => setForm({ ...form, capacidade: e.target.value })}
                placeholder={t("adminCds.placeholders.capacidade")}
              />
            </Field>
            <div className="md:col-span-2">
              <Field label={t("adminCds.fields.endereco")}>
                <Input
                  value={form.endereco}
                  onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                />
              </Field>
            </div>
            <Field label={t("adminCds.fields.cidade")}>
              <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
            </Field>
            <Field label={t("adminCds.fields.estado")}>
              <Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} />
            </Field>
            <Field label={t("adminCds.fields.cep")}>
              <Input
                value={form.cep}
                onChange={(e) => setForm({ ...form, cep: e.target.value })}
                onBlur={handleCepBlur}
              />
              {geoInfo && <p className="text-xs text-muted-foreground">{geoInfo}</p>}
            </Field>
            <div />
            <Field label={t("adminCds.fields.latitude")}>
              <Input
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                placeholder="-23.5505"
                readOnly={coordsLocked}
                className={coordsLocked ? "bg-muted/40" : ""}
              />
            </Field>
            <Field label={t("adminCds.fields.longitude")}>
              <Input
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                placeholder="-46.6333"
                readOnly={coordsLocked}
                className={coordsLocked ? "bg-muted/40" : ""}
              />
            </Field>
            <div className="md:col-span-2 -mt-2">
              <p className="text-[11px] text-muted-foreground">
                {coordsLocked ? t("geo.autoFromCep") : t("geo.manualMode")}{" "}
                <button
                  type="button"
                  onClick={() => setCoordsLocked((v) => !v)}
                  className="text-primary underline hover:brightness-125"
                >
                  {coordsLocked ? t("geo.adjustManually") : t("geo.backToAuto")}
                </button>
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="cd-ativo"
                checked={form.ativo}
                onCheckedChange={(v) => setForm({ ...form, ativo: v })}
              />
              <Label htmlFor="cd-ativo">{t("adminCds.fields.ativo")}</Label>
            </div>
            <div className="md:col-span-2">
              <Field label={t("adminCds.fields.descricao")}>
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
          {t("adminCds.empty")}
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
                  <h3 className="font-semibold text-foreground">{r.nome}</h3>
                  {!r.ativo && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                      {t("adminCds.inactive")}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {[r.cidade, r.estado].filter(Boolean).join(" / ") || t("adminCds.semLocal")}
                  {r.responsavel ? ` · ${r.responsavel}` : ""}
                  {r.telefone ? ` · ${r.telefone}` : ""}
                </p>
                {r.descricao && (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{r.descricao}</p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => toggleAtivo(r)} className="gap-1">
                  <Power className="h-3.5 w-3.5" />
                  {r.ativo ? t("adminCds.deactivate") : t("adminCds.activate")}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOperadoresFor({ id: r.id, nome: r.nome })}
                  className="gap-1"
                >
                  <Users className="h-3.5 w-3.5" /> {t("adminCds.operadores.manage")}
                </Button>
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

      {operadoresFor && (
        <CdOperadoresDialog
          open={!!operadoresFor}
          onOpenChange={(o) => !o && setOperadoresFor(null)}
          centroId={operadoresFor.id}
          centroNome={operadoresFor.nome}
        />
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
