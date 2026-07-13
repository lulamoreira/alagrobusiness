import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { geocodeCep } from "@/lib/geocode";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

type FormState = {
  nome: string;
  responsavel: string;
  telefone: string;
  endereco: string;
  cidade: string;
  estado: string;
  cep: string;
  capacidade: string;
  latitude: string;
  longitude: string;
};

const emptyForm: FormState = {
  nome: "",
  responsavel: "",
  telefone: "",
  endereco: "",
  cidade: "",
  estado: "",
  cep: "",
  capacidade: "",
  latitude: "",
  longitude: "",
};

export function CdSelfRegisterDialog({ open, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [geoInfo, setGeoInfo] = useState<string | null>(null);
  const [coordsLocked, setCoordsLocked] = useState(true);

  const handleCepBlur = async () => {
    const digits = (form.cep || "").replace(/\D+/g, "");
    if (digits.length !== 8) return;
    const geo = await geocodeCep(digits);
    if (!geo) {
      setGeoInfo(t("geo.notFound"));
      return;
    }
    setForm((f) => ({
      ...f,
      endereco: f.endereco || geo.logradouro || "",
      cidade: geo.cidade ?? f.cidade,
      estado: geo.estado ?? f.estado,
      latitude: geo.latitude != null ? String(geo.latitude) : f.latitude,
      longitude: geo.longitude != null ? String(geo.longitude) : f.longitude,
    }));
    setCoordsLocked(true);
    if (geo.latitude != null && geo.longitude != null) {
      setGeoInfo(t("geo.detected", { cidade: geo.cidade ?? "—", estado: geo.estado ?? "—" }));
    } else {
      setGeoInfo(t("geo.noCoords"));
    }
  };

  const save = async () => {
    if (!user) return;
    if (!form.nome.trim() || form.nome.trim().length < 2) {
      toast.error(t("adminCds.errors.nome"));
      return;
    }
    setSaving(true);
    const payload = {
      nome: form.nome.trim(),
      responsavel: form.responsavel.trim() || null,
      telefone: form.telefone.trim() || null,
      endereco: form.endereco.trim() || null,
      cidade: form.cidade.trim() || null,
      estado: form.estado.trim() || null,
      cep: form.cep.trim() || null,
      capacidade: form.capacidade.trim() || null,
      latitude: form.latitude.trim() ? Number(form.latitude) : null,
      longitude: form.longitude.trim() ? Number(form.longitude) : null,
      ativo: true,
      aprovado: false,
      created_by: user.id,
    };
    const { error } = await supabase.from("centros_distribuicao").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("cdSelf.createdPending"));
    setForm(emptyForm);
    setGeoInfo(null);
    onOpenChange(false);
    qc.invalidateQueries({ queryKey: ["meus_cds"] });
    qc.invalidateQueries({ queryKey: ["my_cds_count"] });
    qc.invalidateQueries({ queryKey: ["cds_ativos_form"] });
    qc.invalidateQueries({ queryKey: ["admin", "cds"] });
    onCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-primary" />
            {t("cdSelf.title")}
          </DialogTitle>
          <DialogDescription>{t("cdSelf.subtitle")}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("adminCds.fields.nome")}
            </Label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("adminCds.fields.responsavel")}
            </Label>
            <Input value={form.responsavel} onChange={(e) => setForm({ ...form, responsavel: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("adminCds.fields.telefone")}
            </Label>
            <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("adminCds.fields.cep")}
            </Label>
            <Input value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} onBlur={handleCepBlur} placeholder="00000-000" />
            {geoInfo && <p className="text-[11px] text-muted-foreground">{geoInfo}</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("adminCds.fields.capacidade")}
            </Label>
            <Input value={form.capacidade} onChange={(e) => setForm({ ...form, capacidade: e.target.value })} placeholder={t("adminCds.placeholders.capacidade")} />
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("adminCds.fields.endereco")}
            </Label>
            <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("adminCds.fields.cidade")}
            </Label>
            <Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("adminCds.fields.estado")}
            </Label>
            <Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("adminCds.fields.latitude")}
            </Label>
            <Input
              value={form.latitude}
              onChange={(e) => setForm({ ...form, latitude: e.target.value })}
              readOnly={coordsLocked}
              className={coordsLocked ? "bg-muted/40" : ""}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("adminCds.fields.longitude")}
            </Label>
            <Input
              value={form.longitude}
              onChange={(e) => setForm({ ...form, longitude: e.target.value })}
              readOnly={coordsLocked}
              className={coordsLocked ? "bg-muted/40" : ""}
            />
          </div>
          <div className="md:col-span-2">
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("cdSelf.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
