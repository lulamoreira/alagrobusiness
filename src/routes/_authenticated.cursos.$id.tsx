import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Lock,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { usePlan } from "@/lib/plan";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cursos/$id")({
  component: CursoDetailPage,
});

interface Curso {
  id: string;
  titulo: string;
  descricao: string | null;
  capa_url: string | null;
  categoria: string | null;
}
interface Modulo {
  id: string;
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

function toEmbedUrl(provider: string, url: string): string | null {
  try {
    const u = new URL(url);
    if (provider === "youtube") {
      let id = u.searchParams.get("v");
      if (!id && u.hostname.includes("youtu.be")) id = u.pathname.slice(1);
      if (!id && u.pathname.includes("/embed/")) id = u.pathname.split("/embed/")[1];
      return id ? `https://www.youtube.com/embed/${id}` : url;
    }
    if (provider === "vimeo") {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : url;
    }
  } catch {
    return url;
  }
  return url;
}

function CursoDetailPage() {
  const { id: cursoId } = Route.useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isPro } = usePlan();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedAulaId, setSelectedAulaId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["curso-detalhe", cursoId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: curso, error: e1 } = await supabase
        .from("cursos")
        .select("id, titulo, descricao, capa_url, categoria")
        .eq("id", cursoId)
        .eq("publicado", true)
        .is("deleted_at", null)
        .maybeSingle();
      if (e1) throw e1;

      const { data: modulos } = await supabase
        .from("modulos")
        .select("id, titulo, ordem")
        .eq("curso_id", cursoId)
        .is("deleted_at", null)
        .order("ordem");

      const modIds = (modulos ?? []).map((m) => m.id);
      let aulas: Aula[] = [];
      if (modIds.length) {
        const { data: aulasData } = await supabase
          .from("aulas")
          .select("id, modulo_id, titulo, descricao, duracao_seg, gratis, ordem")
          .in("modulo_id", modIds)
          .is("deleted_at", null)
          .order("ordem");
        aulas = aulasData ?? [];
      }

      const { data: progresso } = await supabase
        .from("progresso_aulas")
        .select("aula_id, concluida")
        .eq("usuario_id", user!.id)
        .is("deleted_at", null);

      return {
        curso: curso as Curso | null,
        modulos: (modulos ?? []) as Modulo[],
        aulas,
        concluidas: new Set(
          (progresso ?? []).filter((p) => p.concluida).map((p) => p.aula_id),
        ),
      };
    },
  });

  const allAulas = useMemo(() => data?.aulas ?? [], [data]);

  // Selecionar aula inicial: primeira não concluída ou primeira aula
  useEffect(() => {
    if (!selectedAulaId && allAulas.length && data) {
      const firstNotDone = allAulas.find((a) => !data.concluidas.has(a.id));
      setSelectedAulaId((firstNotDone ?? allAulas[0]).id);
    }
  }, [allAulas, data, selectedAulaId]);

  const selectedAula = allAulas.find((a) => a.id === selectedAulaId) ?? null;

  const { data: aulaVideo, isLoading: loadingVideo } = useQuery({
    queryKey: ["aula-video", selectedAulaId],
    enabled: !!selectedAulaId,
    queryFn: async () => {
      const { data: v } = await supabase
        .from("aulas_video")
        .select("video_provider, video_url")
        .eq("aula_id", selectedAulaId!)
        .is("deleted_at", null)
        .maybeSingle();
      return v as { video_provider: string; video_url: string } | null;
    },
  });

  const currentIdx = selectedAula ? allAulas.findIndex((a) => a.id === selectedAula.id) : -1;
  const prevAula = currentIdx > 0 ? allAulas[currentIdx - 1] : null;
  const nextAula = currentIdx >= 0 && currentIdx < allAulas.length - 1 ? allAulas[currentIdx + 1] : null;

  const total = allAulas.length;
  const done = data?.concluidas.size ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const marcarConcluida = async () => {
    if (!selectedAula || !user) return;
    setSavingId(selectedAula.id);
    try {
      const { error } = await supabase.from("progresso_aulas").upsert(
        {
          usuario_id: user.id,
          aula_id: selectedAula.id,
          concluida: true,
          assistido_em: new Date().toISOString(),
        },
        { onConflict: "usuario_id,aula_id" },
      );
      if (error) throw error;
      toast.success(t("courses.toastCompleted"));
      await qc.invalidateQueries({ queryKey: ["curso-detalhe", cursoId] });
      await qc.invalidateQueries({ queryKey: ["cursos-catalogo"] });
    } catch (err) {
      console.error(err);
      toast.error(t("courses.toastError"));
    } finally {
      setSavingId(null);
    }
  };

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-3xl border border-border bg-card/40" />;
  }
  if (!data?.curso) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-border bg-card/60 p-12 text-center">
        <h2 className="font-display text-lg font-semibold">{t("courses.notFound")}</h2>
        <Link to="/cursos" className="mt-4 text-sm font-semibold text-primary">
          ← {t("courses.backToCatalog")}
        </Link>
      </div>
    );
  }

  const curso = data.curso;
  const isLocked = selectedAula ? !selectedAula.gratis && !isPro : false;
  const embedUrl = aulaVideo ? toEmbedUrl(aulaVideo.video_provider, aulaVideo.video_url) : null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          to="/cursos"
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("courses.backToCatalog")}
        </Link>
        <h1 className="mt-2 font-display text-2xl font-bold md:text-3xl">{curso.titulo}</h1>
        {curso.descricao && (
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{curso.descricao}</p>
        )}
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-semibold text-primary">
            {pct}% · {done}/{total} {t("courses.lessons")}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Player */}
        <div className="space-y-4">
          <div className="relative aspect-video overflow-hidden rounded-3xl border border-border bg-black">
            {!selectedAula ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {t("courses.selectLesson")}
              </div>
            ) : isLocked || (!loadingVideo && !aulaVideo) ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-primary/10 via-background to-background p-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold">
                    {isLocked ? t("courses.locked") : t("courses.noVideo")}
                  </h3>
                  {isLocked && (
                    <p className="mt-1 max-w-md text-sm text-muted-foreground">
                      {t("courses.lockedDesc")}
                    </p>
                  )}
                </div>
                {isLocked && (
                  <Button onClick={() => navigate({ to: "/planos" })} className="mt-2">
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    {t("courses.subscribe")}
                  </Button>
                )}
              </div>
            ) : loadingVideo ? (
              <div className="h-full w-full animate-pulse bg-muted" />
            ) : embedUrl ? (
              <iframe
                key={embedUrl}
                src={embedUrl}
                title={selectedAula.titulo}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : null}
          </div>

          {selectedAula && (
            <div className="rounded-2xl border border-border bg-card/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-bold">{selectedAula.titulo}</h2>
                  {selectedAula.descricao && (
                    <p className="mt-1 text-sm text-muted-foreground">{selectedAula.descricao}</p>
                  )}
                </div>
                {!isLocked && (
                  <Button
                    variant={data.concluidas.has(selectedAula.id) ? "secondary" : "default"}
                    size="sm"
                    disabled={savingId === selectedAula.id || data.concluidas.has(selectedAula.id)}
                    onClick={marcarConcluida}
                  >
                    <CheckCircle2 className="mr-1.5 h-4 w-4" />
                    {data.concluidas.has(selectedAula.id)
                      ? t("courses.markedComplete")
                      : t("courses.markComplete")}
                  </Button>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!prevAula}
                  onClick={() => prevAula && setSelectedAulaId(prevAula.id)}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  {t("courses.previous")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!nextAula}
                  onClick={() => nextAula && setSelectedAulaId(nextAula.id)}
                >
                  {t("courses.next")}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar módulos/aulas */}
        <aside className="space-y-3">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
            {t("courses.modules")}
          </h3>
          <div className="space-y-4">
            {data.modulos.map((m) => {
              const aulasDoMod = allAulas.filter((a) => a.modulo_id === m.id);
              return (
                <div key={m.id} className="rounded-2xl border border-border bg-card/60">
                  <div className="border-b border-border/60 px-4 py-2.5">
                    <div className="text-sm font-semibold">{m.titulo}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {aulasDoMod.length} {t("courses.lessons")}
                    </div>
                  </div>
                  <ul className="divide-y divide-border/40">
                    {aulasDoMod.map((a) => {
                      const active = a.id === selectedAulaId;
                      const isDone = data.concluidas.has(a.id);
                      const aLocked = !a.gratis && !isPro;
                      return (
                        <li key={a.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedAulaId(a.id)}
                            className={cn(
                              "flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition hover:bg-accent",
                              active && "bg-primary/10 text-primary",
                            )}
                          >
                            {isDone ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                            ) : aLocked ? (
                              <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                            ) : (
                              <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                            )}
                            <span className="flex-1 truncate">{a.titulo}</span>
                            {a.gratis ? (
                              <span className="rounded-full border border-border bg-background/60 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                {t("courses.freeBadge")}
                              </span>
                            ) : (
                              <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                                {t("courses.proBadge")}
                              </span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                    {!aulasDoMod.length && (
                      <li className="px-4 py-3 text-xs text-muted-foreground">—</li>
                    )}
                  </ul>
                </div>
              );
            })}
            {!data.modulos.length && (
              <div className="rounded-2xl border border-border bg-card/60 p-6 text-center text-sm text-muted-foreground">
                <PlayCircle className="mx-auto mb-2 h-6 w-6 opacity-50" />
                {t("courses.empty")}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
