import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BookOpen, GraduationCap, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/cursos/")({
  component: CursosCatalogoPage,
});

interface CursoCard {
  id: string;
  titulo: string;
  descricao: string | null;
  capa_url: string | null;
  categoria: string | null;
  total_aulas: number;
  concluidas: number;
}

function CursosCatalogoPage() {
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["cursos-catalogo", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<CursoCard[]> => {
      const { data: cursos, error } = await supabase
        .from("cursos")
        .select("id, titulo, descricao, capa_url, categoria, ordem, modulos!inner(id, aulas(id))")
        .eq("publicado", true)
        .is("deleted_at", null)
        .order("ordem", { ascending: true });
      if (error) throw error;

      const cursoIds = (cursos ?? []).map((c) => c.id);
      let progresso: { aula_id: string }[] = [];
      if (cursoIds.length && user) {
        const { data: prog } = await supabase
          .from("progresso_aulas")
          .select("aula_id")
          .eq("usuario_id", user.id)
          .eq("concluida", true)
          .is("deleted_at", null);
        progresso = prog ?? [];
      }
      const concluidasSet = new Set(progresso.map((p) => p.aula_id));

      return (cursos ?? []).map((c) => {
        const aulasIds: string[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c.modulos as any[])?.forEach((m) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          m.aulas?.forEach((a: any) => aulasIds.push(a.id));
        });
        const total = aulasIds.length;
        const concluidas = aulasIds.filter((id) => concluidasSet.has(id)).length;
        return {
          id: c.id,
          titulo: c.titulo,
          descricao: c.descricao,
          capa_url: c.capa_url,
          categoria: c.categoria,
          total_aulas: total,
          concluidas,
        };
      });
    },
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
          <GraduationCap className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">{t("courses.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("courses.subtitle")}</p>
        </div>
      </header>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-3xl border border-border bg-card/40" />
          ))}
        </div>
      ) : !data?.length ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-border bg-card/60 p-12 text-center">
          <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/60" />
          <h2 className="font-display text-lg font-semibold">{t("courses.empty")}</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{t("courses.emptyDesc")}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => {
            const pct = c.total_aulas > 0 ? Math.round((c.concluidas / c.total_aulas) * 100) : 0;
            const started = c.concluidas > 0;
            return (
              <Link
                key={c.id}
                to="/cursos/$id"
                params={{ id: c.id }}
                className="group relative flex flex-col overflow-hidden rounded-3xl border border-border bg-card/70 shadow-lg backdrop-blur transition hover:border-primary/40 hover:shadow-xl"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-gradient-to-br from-primary/20 via-primary/5 to-transparent">
                  {c.capa_url ? (
                    <img
                      src={c.capa_url}
                      alt={c.titulo}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <BookOpen className="h-10 w-10 text-primary/60" />
                    </div>
                  )}
                  {c.categoria && (
                    <span className="absolute left-3 top-3 rounded-full border border-border/60 bg-background/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-foreground backdrop-blur">
                      {c.categoria}
                    </span>
                  )}
                </div>
                <div className="flex flex-1 flex-col gap-2 p-4">
                  <h3 className="font-display text-lg font-bold leading-tight">{c.titulo}</h3>
                  {c.descricao && (
                    <p className="line-clamp-2 text-sm text-muted-foreground">{c.descricao}</p>
                  )}
                  <div className="mt-auto space-y-2 pt-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {c.concluidas} {t("courses.ofTotal")} {c.total_aulas} {t("courses.lessons")}
                      </span>
                      <span className={cn("font-semibold", started ? "text-primary" : "text-muted-foreground")}>
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1 text-sm font-semibold text-primary">
                      <PlayCircle className="h-4 w-4" />
                      {started ? t("courses.continueCourse") : t("courses.startCourse")}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
