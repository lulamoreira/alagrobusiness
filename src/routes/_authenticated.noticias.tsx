import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NewsCard } from "@/components/NewsCard";

export const Route = createFileRoute("/_authenticated/noticias")({
  component: NoticiasPage,
});

function NoticiasPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["noticias_all"],
    queryFn: async () =>
      (
        await supabase
          .from("noticias")
          .select("*")
          .is("deleted_at", null)
          .order("publicado_em", { ascending: false, nullsFirst: false })
          .limit(60)
      ).data ?? [],
  });

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold md:text-3xl">{t("news.title")}</h1>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : data && data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((n) => (
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
