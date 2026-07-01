import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  PlayCircle,
} from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/cursos")({
  component: AdminCursosPage,
});

interface Curso {
  id: string;
  titulo: string;
  descricao: string | null;
  capa_url: string | null;
  categoria: string | null;
  publicado: boolean;
  ordem: number;
}
interface Modulo {
  id: string;
  curso_id: string;
  titulo: string;
  ordem: number;
}
interface Aula {
  id: string;
  modulo_id: string;
  titulo: string;
  descricao: string | null;
  duracao_seg: number | null;
  gratis: boolean;
  ordem: number;
}
interface AulaVideo {
  aula_id: string;
  video_provider: "youtube" | "vimeo";
  video_url: string;
}

type CursoForm = {
  id?: string;
  titulo: string;
  descricao: string;
  capa_url: string;
  categoria: string;
  publicado: boolean;
  ordem: number;
};
type ModuloForm = { id?: string; curso_id: string; titulo: string; ordem: number };
type AulaForm = {
  id?: string;
  modulo_id: string;
  titulo: string;
  descricao: string;
  duracao_seg: string;
  gratis: boolean;
  ordem: number;
  video_provider: "youtube" | "vimeo";
  video_url: string;
};

function AdminCursosPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [modulosByCurso, setModulosByCurso] = useState<Record<string, Modulo[]>>({});
  const [aulasByModulo, setAulasByModulo] = useState<Record<string, Aula[]>>({});
  const [videosByAula, setVideosByAula] = useState<Record<string, AulaVideo>>({});
  const [openCursos, setOpenCursos] = useState<Record<string, boolean>>({});
  const [openModulos, setOpenModulos] = useState<Record<string, boolean>>({});

  const [cursoDialog, setCursoDialog] = useState<CursoForm | null>(null);
  const [moduloDialog, setModuloDialog] = useState<ModuloForm | null>(null);
  const [aulaDialog, setAulaDialog] = useState<AulaForm | null>(null);
  const [busy, setBusy] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<
    | { kind: "curso" | "modulo" | "aula"; id: string; parent?: string }
    | null
  >(null);

  useEffect(() => {
    if (profile && profile.tipo_perfil !== "admin") {
      navigate({ to: "/painel" });
    }
  }, [profile, navigate]);

  const cursoSchema = useMemo(
    () =>
      z.object({
        titulo: z.string().trim().min(1, t("adminCourses.titleRequired")).max(160),
        descricao: z.string().max(2000).optional().or(z.literal("")),
        capa_url: z.string().max(500).optional().or(z.literal("")),
        categoria: z.string().max(80).optional().or(z.literal("")),
        publicado: z.boolean(),
        ordem: z.number().int(),
      }),
    [t],
  );
  const moduloSchema = useMemo(
    () =>
      z.object({
        titulo: z.string().trim().min(1, t("adminCourses.titleRequired")).max(160),
        ordem: z.number().int(),
      }),
    [t],
  );
  const aulaSchema = useMemo(
    () =>
      z.object({
        titulo: z.string().trim().min(1, t("adminCourses.titleRequired")).max(160),
        descricao: z.string().max(2000).optional().or(z.literal("")),
        duracao_seg: z.string().optional(),
        gratis: z.boolean(),
        ordem: z.number().int(),
        video_provider: z.enum(["youtube", "vimeo"], {
          errorMap: () => ({ message: t("adminCourses.providerRequired") }),
        }),
        video_url: z
          .string()
          .trim()
          .min(1, t("adminCourses.urlRequired"))
          .url(t("adminCourses.urlInvalid")),
      }),
    [t],
  );

  const loadAll = async () => {
    setLoading(true);
    const [cursosRes, modulosRes, aulasRes, videosRes] = await Promise.all([
      supabase
        .from("cursos" as never)
        .select("*")
        .is("deleted_at", null)
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("modulos" as never)
        .select("*")
        .is("deleted_at", null)
        .order("ordem", { ascending: true }),
      supabase
        .from("aulas" as never)
        .select("*")
        .is("deleted_at", null)
        .order("ordem", { ascending: true }),
      supabase
        .from("aulas_video" as never)
        .select("aula_id, video_provider, video_url")
        .is("deleted_at", null),
    ]);
    setLoading(false);

    if (cursosRes.error) {
      toast.error(cursosRes.error.message);
      return;
    }
    setCursos((cursosRes.data ?? []) as Curso[]);

    const mMap: Record<string, Modulo[]> = {};
    for (const m of (modulosRes.data ?? []) as Modulo[]) {
      (mMap[m.curso_id] ||= []).push(m);
    }
    setModulosByCurso(mMap);

    const aMap: Record<string, Aula[]> = {};
    for (const a of (aulasRes.data ?? []) as Aula[]) {
      (aMap[a.modulo_id] ||= []).push(a);
    }
    setAulasByModulo(aMap);

    const vMap: Record<string, AulaVideo> = {};
    for (const v of (videosRes.data ?? []) as AulaVideo[]) {
      vMap[v.aula_id] = v;
    }
    setVideosByAula(vMap);
  };

  useEffect(() => {
    loadAll();
  }, []);

  // -------- Curso CRUD --------
  const openNovoCurso = () =>
    setCursoDialog({
      titulo: "",
      descricao: "",
      capa_url: "",
      categoria: "",
      publicado: false,
      ordem: cursos.length,
    });
  const openEditarCurso = (c: Curso) =>
    setCursoDialog({
      id: c.id,
      titulo: c.titulo,
      descricao: c.descricao ?? "",
      capa_url: c.capa_url ?? "",
      categoria: c.categoria ?? "",
      publicado: c.publicado,
      ordem: c.ordem,
    });

  const salvarCurso = async () => {
    if (!cursoDialog) return;
    const parsed = cursoSchema.safeParse(cursoDialog);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "");
      return;
    }
    setBusy(true);
    const payload = {
      titulo: cursoDialog.titulo.trim(),
      descricao: cursoDialog.descricao.trim() || null,
      capa_url: cursoDialog.capa_url.trim() || null,
      categoria: cursoDialog.categoria.trim() || null,
      publicado: cursoDialog.publicado,
      ordem: cursoDialog.ordem,
    };
    const { error } = cursoDialog.id
      ? await supabase.from("cursos" as never).update(payload as never).eq("id", cursoDialog.id)
      : await supabase.from("cursos" as never).insert(payload as never);
    setBusy(false);
    if (error) {
      toast.error(t("adminCourses.errorSave", { detail: error.message }));
      return;
    }
    toast.success(t("adminCourses.savedCourse"));
    setCursoDialog(null);
    await loadAll();
  };

  const togglePublicado = async (c: Curso) => {
    const { error } = await supabase
      .from("cursos" as never)
      .update({ publicado: !c.publicado } as never)
      .eq("id", c.id);
    if (error) {
      toast.error(t("adminCourses.errorSave", { detail: error.message }));
      return;
    }
    await loadAll();
  };

  // -------- Módulo CRUD --------
  const openNovoModulo = (cursoId: string) =>
    setModuloDialog({
      curso_id: cursoId,
      titulo: "",
      ordem: (modulosByCurso[cursoId]?.length ?? 0),
    });
  const openEditarModulo = (m: Modulo) =>
    setModuloDialog({ id: m.id, curso_id: m.curso_id, titulo: m.titulo, ordem: m.ordem });

  const salvarModulo = async () => {
    if (!moduloDialog) return;
    const parsed = moduloSchema.safeParse(moduloDialog);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "");
      return;
    }
    setBusy(true);
    const payload = {
      curso_id: moduloDialog.curso_id,
      titulo: moduloDialog.titulo.trim(),
      ordem: moduloDialog.ordem,
    };
    const { error } = moduloDialog.id
      ? await supabase.from("modulos" as never).update(payload as never).eq("id", moduloDialog.id)
      : await supabase.from("modulos" as never).insert(payload as never);
    setBusy(false);
    if (error) {
      toast.error(t("adminCourses.errorSave", { detail: error.message }));
      return;
    }
    toast.success(t("adminCourses.savedModule"));
    setModuloDialog(null);
    await loadAll();
  };

  // -------- Aula CRUD --------
  const openNovaAula = (moduloId: string) =>
    setAulaDialog({
      modulo_id: moduloId,
      titulo: "",
      descricao: "",
      duracao_seg: "",
      gratis: false,
      ordem: aulasByModulo[moduloId]?.length ?? 0,
      video_provider: "youtube",
      video_url: "",
    });
  const openEditarAula = (a: Aula) => {
    const v = videosByAula[a.id];
    setAulaDialog({
      id: a.id,
      modulo_id: a.modulo_id,
      titulo: a.titulo,
      descricao: a.descricao ?? "",
      duracao_seg: a.duracao_seg != null ? String(a.duracao_seg) : "",
      gratis: a.gratis,
      ordem: a.ordem,
      video_provider: v?.video_provider ?? "youtube",
      video_url: v?.video_url ?? "",
    });
  };

  const salvarAula = async () => {
    if (!aulaDialog) return;
    const parsed = aulaSchema.safeParse(aulaDialog);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "");
      return;
    }
    setBusy(true);
    const dur = aulaDialog.duracao_seg.trim() === "" ? null : Number(aulaDialog.duracao_seg);
    const aulaPayload = {
      modulo_id: aulaDialog.modulo_id,
      titulo: aulaDialog.titulo.trim(),
      descricao: aulaDialog.descricao.trim() || null,
      duracao_seg: Number.isFinite(dur as number) ? dur : null,
      gratis: aulaDialog.gratis,
      ordem: aulaDialog.ordem,
    };

    let aulaId = aulaDialog.id;
    if (aulaId) {
      const { error } = await supabase
        .from("aulas" as never)
        .update(aulaPayload as never)
        .eq("id", aulaId);
      if (error) {
        setBusy(false);
        toast.error(t("adminCourses.errorSave", { detail: error.message }));
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("aulas" as never)
        .insert(aulaPayload as never)
        .select("id")
        .single();
      if (error || !data) {
        setBusy(false);
        toast.error(t("adminCourses.errorSave", { detail: error?.message ?? "" }));
        return;
      }
      aulaId = (data as { id: string }).id;
    }

    // Upsert vídeo
    const videoPayload = {
      aula_id: aulaId!,
      video_provider: aulaDialog.video_provider,
      video_url: aulaDialog.video_url.trim(),
    };
    const { error: vErr } = await supabase
      .from("aulas_video" as never)
      .upsert(videoPayload as never, { onConflict: "aula_id" } as never);
    setBusy(false);
    if (vErr) {
      toast.error(t("adminCourses.errorSave", { detail: vErr.message }));
      return;
    }
    toast.success(t("adminCourses.savedLesson"));
    setAulaDialog(null);
    await loadAll();
  };

  // -------- Exclusão (soft delete) --------
  const confirmarExclusao = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    const table =
      confirmDelete.kind === "curso"
        ? "cursos"
        : confirmDelete.kind === "modulo"
          ? "modulos"
          : "aulas";
    const { error } = await supabase
      .from(table as never)
      .update({ deleted_at: new Date().toISOString() } as never)
      .eq("id", confirmDelete.id);
    setBusy(false);
    if (error) {
      toast.error(t("adminCourses.errorDelete", { detail: error.message }));
      return;
    }
    toast.success(
      confirmDelete.kind === "curso"
        ? t("adminCourses.deletedCourse")
        : confirmDelete.kind === "modulo"
          ? t("adminCourses.deletedModule")
          : t("adminCourses.deletedLesson"),
    );
    setConfirmDelete(null);
    await loadAll();
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 p-4 md:p-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-primary/10 p-3">
            <BookOpen className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
              {t("adminCourses.title")}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              {t("adminCourses.subtitle")}
            </p>
          </div>
        </div>
        <Button onClick={openNovoCurso} className="md:self-start">
          <Plus className="mr-2 h-4 w-4" />
          {t("adminCourses.newCourse")}
        </Button>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : cursos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/30 p-10 text-center text-sm text-muted-foreground">
          {t("adminCourses.noCourses")}
        </div>
      ) : (
        <div className="space-y-4">
          {cursos.map((c) => {
            const isOpen = !!openCursos[c.id];
            const modulos = modulosByCurso[c.id] ?? [];
            return (
              <section
                key={c.id}
                className="overflow-hidden rounded-2xl border border-border/60 bg-card/40 backdrop-blur"
              >
                <header className="flex flex-col gap-3 border-b border-border/40 p-4 md:flex-row md:items-center md:justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setOpenCursos((s) => ({ ...s, [c.id]: !s[c.id] }))
                    }
                    className="flex flex-1 items-center gap-3 text-left"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate font-display text-lg font-semibold">
                          {c.titulo}
                        </h2>
                        <Badge variant={c.publicado ? "default" : "secondary"}>
                          {c.publicado
                            ? t("adminCourses.published")
                            : t("adminCourses.draft")}
                        </Badge>
                      </div>
                      {c.categoria ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {c.categoria}
                        </p>
                      ) : null}
                    </div>
                  </button>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => togglePublicado(c)}
                      title={
                        c.publicado
                          ? t("adminCourses.unpublish")
                          : t("adminCourses.publish")
                      }
                    >
                      {c.publicado ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditarCurso(c)}
                      title={t("adminCourses.editCourse")}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        setConfirmDelete({ kind: "curso", id: c.id })
                      }
                      title={t("adminCourses.deleteCourse")}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </header>

                {isOpen && (
                  <div className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        {t("adminCourses.modules")}
                      </h3>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openNovoModulo(c.id)}
                      >
                        <Plus className="mr-1.5 h-3.5 w-3.5" />
                        {t("adminCourses.moduleAdd")}
                      </Button>
                    </div>

                    {modulos.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-border/50 p-4 text-center text-xs text-muted-foreground">
                        {t("adminCourses.modulesEmpty")}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {modulos.map((m) => {
                          const mOpen = !!openModulos[m.id];
                          const aulas = aulasByModulo[m.id] ?? [];
                          return (
                            <div
                              key={m.id}
                              className="rounded-xl border border-border/50 bg-background/40"
                            >
                              <div className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOpenModulos((s) => ({
                                      ...s,
                                      [m.id]: !s[m.id],
                                    }))
                                  }
                                  className="flex flex-1 items-center gap-2 text-left"
                                >
                                  {mOpen ? (
                                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                                  )}
                                  <span className="truncate text-sm font-medium">
                                    {m.titulo}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    ({aulas.length})
                                  </span>
                                </button>
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => openEditarModulo(m)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      setConfirmDelete({
                                        kind: "modulo",
                                        id: m.id,
                                      })
                                    }
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </div>
                              </div>

                              {mOpen && (
                                <div className="space-y-2 border-t border-border/40 p-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-muted-foreground">
                                      {t("adminCourses.lessons")}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openNovaAula(m.id)}
                                    >
                                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                                      {t("adminCourses.lessonAdd")}
                                    </Button>
                                  </div>

                                  {aulas.length === 0 ? (
                                    <p className="rounded-lg border border-dashed border-border/40 p-3 text-center text-xs text-muted-foreground">
                                      {t("adminCourses.lessonsEmpty")}
                                    </p>
                                  ) : (
                                    <ul className="space-y-1.5">
                                      {aulas.map((a) => {
                                        const v = videosByAula[a.id];
                                        return (
                                          <li
                                            key={a.id}
                                            className={cn(
                                              "flex items-center gap-2 rounded-lg border border-border/40 bg-card/40 px-3 py-2 text-sm",
                                            )}
                                          >
                                            <PlayCircle className="h-4 w-4 text-primary/70" />
                                            <span className="flex-1 truncate">
                                              {a.titulo}
                                            </span>
                                            <Badge
                                              variant={
                                                a.gratis ? "default" : "secondary"
                                              }
                                            >
                                              {a.gratis
                                                ? t("adminCourses.free")
                                                : t("adminCourses.paid")}
                                            </Badge>
                                            {v ? (
                                              <span className="text-xs text-muted-foreground">
                                                {v.video_provider}
                                              </span>
                                            ) : null}
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() => openEditarAula(a)}
                                            >
                                              <Pencil className="h-3.5 w-3.5" />
                                            </Button>
                                            <Button
                                              size="sm"
                                              variant="ghost"
                                              onClick={() =>
                                                setConfirmDelete({
                                                  kind: "aula",
                                                  id: a.id,
                                                })
                                              }
                                            >
                                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                            </Button>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {/* -------- Dialog Curso -------- */}
      <Dialog open={!!cursoDialog} onOpenChange={(o) => !o && setCursoDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {cursoDialog?.id
                ? t("adminCourses.editCourse")
                : t("adminCourses.newCourse")}
            </DialogTitle>
          </DialogHeader>
          {cursoDialog && (
            <div className="space-y-3">
              <div>
                <Label>{t("adminCourses.titleField")}</Label>
                <Input
                  value={cursoDialog.titulo}
                  onChange={(e) =>
                    setCursoDialog({ ...cursoDialog, titulo: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{t("adminCourses.descriptionField")}</Label>
                <Textarea
                  value={cursoDialog.descricao}
                  onChange={(e) =>
                    setCursoDialog({ ...cursoDialog, descricao: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div>
                <Label>{t("adminCourses.coverField")}</Label>
                <Input
                  value={cursoDialog.capa_url}
                  onChange={(e) =>
                    setCursoDialog({ ...cursoDialog, capa_url: e.target.value })
                  }
                  placeholder={t("adminCourses.coverPlaceholder")}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("adminCourses.categoryField")}</Label>
                  <Input
                    value={cursoDialog.categoria}
                    onChange={(e) =>
                      setCursoDialog({
                        ...cursoDialog,
                        categoria: e.target.value,
                      })
                    }
                    placeholder={t("adminCourses.categoryPlaceholder")}
                  />
                </div>
                <div>
                  <Label>{t("adminCourses.orderField")}</Label>
                  <Input
                    type="number"
                    value={cursoDialog.ordem}
                    onChange={(e) =>
                      setCursoDialog({
                        ...cursoDialog,
                        ordem: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
                <span className="text-sm">
                  {cursoDialog.publicado
                    ? t("adminCourses.published")
                    : t("adminCourses.draft")}
                </span>
                <Switch
                  checked={cursoDialog.publicado}
                  onCheckedChange={(v) =>
                    setCursoDialog({ ...cursoDialog, publicado: v })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCursoDialog(null)}>
              {t("adminCourses.cancel")}
            </Button>
            <Button onClick={salvarCurso} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("adminCourses.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------- Dialog Módulo -------- */}
      <Dialog open={!!moduloDialog} onOpenChange={(o) => !o && setModuloDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {moduloDialog?.id
                ? t("adminCourses.editModule")
                : t("adminCourses.newModule")}
            </DialogTitle>
          </DialogHeader>
          {moduloDialog && (
            <div className="space-y-3">
              <div>
                <Label>{t("adminCourses.titleField")}</Label>
                <Input
                  value={moduloDialog.titulo}
                  onChange={(e) =>
                    setModuloDialog({ ...moduloDialog, titulo: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{t("adminCourses.orderField")}</Label>
                <Input
                  type="number"
                  value={moduloDialog.ordem}
                  onChange={(e) =>
                    setModuloDialog({
                      ...moduloDialog,
                      ordem: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setModuloDialog(null)}>
              {t("adminCourses.cancel")}
            </Button>
            <Button onClick={salvarModulo} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("adminCourses.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------- Dialog Aula -------- */}
      <Dialog open={!!aulaDialog} onOpenChange={(o) => !o && setAulaDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {aulaDialog?.id
                ? t("adminCourses.editLesson")
                : t("adminCourses.newLesson")}
            </DialogTitle>
          </DialogHeader>
          {aulaDialog && (
            <div className="space-y-3">
              <div>
                <Label>{t("adminCourses.titleField")}</Label>
                <Input
                  value={aulaDialog.titulo}
                  onChange={(e) =>
                    setAulaDialog({ ...aulaDialog, titulo: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>{t("adminCourses.descriptionField")}</Label>
                <Textarea
                  value={aulaDialog.descricao}
                  onChange={(e) =>
                    setAulaDialog({ ...aulaDialog, descricao: e.target.value })
                  }
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("adminCourses.durationField")}</Label>
                  <Input
                    type="number"
                    value={aulaDialog.duracao_seg}
                    onChange={(e) =>
                      setAulaDialog({
                        ...aulaDialog,
                        duracao_seg: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label>{t("adminCourses.orderField")}</Label>
                  <Input
                    type="number"
                    value={aulaDialog.ordem}
                    onChange={(e) =>
                      setAulaDialog({
                        ...aulaDialog,
                        ordem: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/40 p-3">
                <span className="text-sm">{t("adminCourses.freeLesson")}</span>
                <Switch
                  checked={aulaDialog.gratis}
                  onCheckedChange={(v) =>
                    setAulaDialog({ ...aulaDialog, gratis: v })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>{t("adminCourses.videoProvider")}</Label>
                  <Select
                    value={aulaDialog.video_provider}
                    onValueChange={(v) =>
                      setAulaDialog({
                        ...aulaDialog,
                        video_provider: v as "youtube" | "vimeo",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="youtube">
                        {t("adminCourses.youtube")}
                      </SelectItem>
                      <SelectItem value="vimeo">
                        {t("adminCourses.vimeo")}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("adminCourses.videoUrl")}</Label>
                  <Input
                    value={aulaDialog.video_url}
                    onChange={(e) =>
                      setAulaDialog({
                        ...aulaDialog,
                        video_url: e.target.value,
                      })
                    }
                    placeholder={t("adminCourses.videoUrlPlaceholder")}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAulaDialog(null)}>
              {t("adminCourses.cancel")}
            </Button>
            <Button onClick={salvarAula} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("adminCourses.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* -------- Confirm Delete -------- */}
      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("adminCourses.confirmDeleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("adminCourses.confirmDelete")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("adminCourses.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmarExclusao} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("adminCourses.save")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
