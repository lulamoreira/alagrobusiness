import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Award, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/certificados/")({
  component: CertificadosPage,
});

interface CertificadoRow {
  id: string;
  codigo: string;
  emitido_em: string;
  curso: { id: string; titulo: string; categoria: string | null } | null;
}

function CertificadosPage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["certificados-lista", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificados")
        .select("id, codigo, emitido_em, curso:cursos(id, titulo, categoria)")
        .eq("usuario_id", user!.id)
        .is("deleted_at", null)
        .order("emitido_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CertificadoRow[];
    },
  });

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString(i18n.language, {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
            <Award className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold md:text-3xl">
              {t("certificates.title")}
            </h1>
            <p className="text-sm text-muted-foreground">{t("certificates.subtitle")}</p>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-3xl border border-border bg-card/40" />
          ))}
        </div>
      ) : !data?.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-border bg-card/60 p-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-background/60">
            <Award className="h-6 w-6 text-muted-foreground" />
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">{t("certificates.empty")}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("certificates.emptyDesc")}</p>
          </div>
          <Button asChild size="sm" className="mt-2">
            <Link to="/cursos">{t("certificates.browseCourses")}</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.map((c) => (
            <Link
              key={c.id}
              to="/certificado/$codigo"
              params={{ codigo: c.codigo }}
              className="group relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-5 transition hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10"
            >
              <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/10 blur-3xl" />
              <div className="relative">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-primary" />
                  {c.curso?.categoria && (
                    <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {c.curso.categoria}
                    </span>
                  )}
                </div>
                <h3 className="mt-3 font-display text-lg font-bold leading-tight">
                  {c.curso?.titulo ?? "—"}
                </h3>
                <dl className="mt-4 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <dt>{t("certificates.issuedOn")}</dt>
                    <dd className="font-semibold text-foreground">{fmt(c.emitido_em)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>{t("certificates.code")}</dt>
                    <dd className="font-mono text-foreground">{c.codigo}</dd>
                  </div>
                </dl>
                <div className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                  {t("certificates.view")}
                  <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
