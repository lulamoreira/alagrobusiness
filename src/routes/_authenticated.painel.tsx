import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { NewsCard } from "@/components/NewsCard";
import { formatDolarValue } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/painel")({
  component: PainelPage,
});

function PainelPage() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();

  const { data: dolar } = useQuery({
    queryKey: ["cotacoes_dolar"],
    queryFn: async () =>
      (await supabase.from("cotacoes_dolar").select("*").is("deleted_at", null)).data ?? [],
  });

  const { data: noticias } = useQuery({
    queryKey: ["noticias_recentes"],
    queryFn: async () =>
      (
        await supabase
          .from("noticias")
          .select("*")
          .is("deleted_at", null)
          .order("publicado_em", { ascending: false, nullsFirst: false })
          .limit(6)
      ).data ?? [],
  });

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-2xl font-bold md:text-3xl">
          {t("dashboard.hello")}, {profile?.nome_completo?.split(" ")[0] ?? "👋"}
        </h1>
        <p className="text-sm text-muted-foreground">{t("dashboard.summary")}</p>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("dashboard.dollar")}</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(["comercial", "turismo", "paralelo"] as const).map((tipo) => {
            const row = dolar?.find((d) => d.tipo === tipo);
            return (
              <div
                key={tipo}
                className="rounded-2xl border border-border bg-card p-5"
              >
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t(`settings.${tipo}`)}
                </div>
                <div className="mt-2 font-display text-2xl font-bold text-foreground">
                  {row ? formatDolarValue(Number(row.valor_brl), i18n.language) : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("dashboard.news")}</h2>
        {noticias && noticias.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {noticias.map((n) => (
              <NewsCard key={n.id} item={n} />
            ))}
          </div>
        ) : (
          <p className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
            {t("dashboard.noNews")}
          </p>
        )}
      </section>
    </div>
  );
}
