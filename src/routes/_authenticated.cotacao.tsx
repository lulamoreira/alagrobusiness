import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatDolarValue } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/cotacao")({
  component: CotacaoPage,
});

function CotacaoPage() {
  const { t, i18n } = useTranslation();
  const { data } = useQuery({
    queryKey: ["cotacoes_dolar"],
    queryFn: async () =>
      (await supabase.from("cotacoes_dolar").select("*").is("deleted_at", null)).data ?? [],
  });
  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold md:text-3xl">{t("nav.quote")}</h1>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(["comercial", "turismo", "paralelo"] as const).map((tipo) => {
          const row = data?.find((d) => d.tipo === tipo);
          return (
            <div key={tipo} className="rounded-2xl border border-border bg-card p-5">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                {t(`settings.${tipo}`)}
              </div>
              <div className="mt-2 font-display text-2xl font-bold">
                {row ? formatDolarValue(Number(row.valor_brl), i18n.language) : "—"}
              </div>
              {row?.atualizado_em && (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  {new Date(row.atualizado_em).toLocaleString(i18n.language)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
