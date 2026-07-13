import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NewsCard } from "@/components/NewsCard";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/noticias")({
  component: NoticiasPage,
});

type Mode = "mine" | "all";

function NoticiasPage() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>("mine");
  const [activeThemes, setActiveThemes] = useState<Set<string>>(new Set());

  const { data: prefs } = useQuery({
    queryKey: ["prefs_temas"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return { temas: [] as string[] };
      const { data } = await supabase
        .from("preferencias")
        .select("temas_noticias")
        .eq("usuario_id", u.user.id)
        .maybeSingle();
      return { temas: (data?.temas_noticias ?? []) as string[] };
    },
  });

  const { data: noticias, isLoading } = useQuery({
    queryKey: ["noticias_all"],
    queryFn: async () =>
      (
        await supabase
          .from("noticias")
          .select("*")
          .is("deleted_at", null)
          .order("publicado_em", { ascending: false, nullsFirst: false })
          .limit(120)
      ).data ?? [],
  });

  const userThemes = prefs?.temas ?? [];
  const hasInterests = userThemes.length > 0;
  const effectiveMode: Mode = mode === "mine" && !hasInterests ? "mine" : mode;

  // Temas presentes nas notícias (para chips)
  const availableThemes = useMemo(() => {
    const set = new Set<string>();
    (noticias ?? []).forEach((n) => {
      if (n.tema) set.add(n.tema);
    });
    return Array.from(set).sort();
  }, [noticias]);

  const filtered = useMemo(() => {
    let list = noticias ?? [];
    if (effectiveMode === "mine") {
      const allowed = new Set<string>([...userThemes, "geral"]);
      list = list.filter((n) => n.tema && allowed.has(n.tema));
    }
    if (activeTheme) {
      list = list.filter((n) => n.tema === activeTheme);
    }
    return list;
  }, [noticias, effectiveMode, userThemes, activeTheme]);

  const showNoInterestsHint = mode === "mine" && !hasInterests;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold md:text-3xl">{t("news.title")}</h1>
        <div className="inline-flex rounded-full border border-border bg-card p-1">
          {(["mine", "all"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-medium transition-colors",
                mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(m === "mine" ? "news.myThemes" : "news.allThemes")}
            </button>
          ))}
        </div>
      </div>

      {showNoInterestsHint ? (
        <p className="rounded-2xl border border-border bg-card/60 px-4 py-3 text-xs text-muted-foreground">
          {t("news.noInterestsHint")}
        </p>
      ) : null}

      {availableThemes.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTheme(null)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition-colors",
              activeTheme === null
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {t("news.allChip")}
          </button>
          {availableThemes.map((tema) => (
            <button
              key={tema}
              type="button"
              onClick={() => setActiveTheme(tema === activeTheme ? null : tema)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                activeTheme === tema
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`themes.${tema}`, { defaultValue: tema })}
            </button>
          ))}
        </div>
      ) : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : filtered.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((n) => (
            <NewsCard key={n.id} item={n} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
          {t("news.empty")}
        </p>
      )}
    </div>
  );
}
