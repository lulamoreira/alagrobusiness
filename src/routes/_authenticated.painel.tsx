import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { NewsCard } from "@/components/NewsCard";
import { formatMoney, formatDolarValue } from "@/lib/format";
import {
  computeVariation,
  groupCommodityHistory,
  groupDolarHistory,
  PAINEL_MAX_FEATURED,
  type CommodityRow,
  type DolarHistoryRow,
} from "@/lib/quotes";
import { useCommoditiesCatalog, useQuotePreferences, nomeFor } from "@/lib/catalog";
import { VariationBadge } from "@/components/VariationBadge";
import { WeatherCard } from "@/components/WeatherCard";
import { BusinessDashboard } from "@/components/BusinessDashboard";
import { MobilePainel } from "@/components/MobilePainel";

export const Route = createFileRoute("/_authenticated/painel")({
  component: PainelPage,
});

type DolarTipo = "comercial" | "turismo" | "paralelo";

function PainelPage() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const userMoeda = profile?.moeda_preferida ?? "BRL";
  const userDolarPref = (profile?.tipo_dolar_preferido ?? "comercial") as DolarTipo;

  const { data: catalog = [] } = useCommoditiesCatalog();
  const { data: prefs } = useQuotePreferences(profile?.id);

  const { data: dolar } = useQuery({
    queryKey: ["cotacoes_dolar"],
    queryFn: async () =>
      (await supabase.from("cotacoes_dolar").select("*").is("deleted_at", null)).data ?? [],
  });

  const { data: dolarHistory } = useQuery({
    queryKey: ["cotacoes_dolar_historico_all"],
    queryFn: async (): Promise<DolarHistoryRow[]> => {
      const { data } = await supabase
        .from("cotacoes_dolar_historico")
        .select("tipo, valor_brl, data")
        .is("deleted_at", null)
        .order("data", { ascending: true });
      return (data ?? []).map((r) => ({
        tipo: r.tipo as DolarTipo,
        valor_brl: Number(r.valor_brl),
        data: r.data as string,
      }));
    },
  });

  const { data: commodityRows } = useQuery({
    queryKey: ["cotacoes_commodities_painel_all"],
    queryFn: async (): Promise<CommodityRow[]> => {
      const { data } = await supabase
        .from("cotacoes_commodities")
        .select("produto, valor, data, fonte, fonte_url, unidade_id, moeda")
        .is("deleted_at", null)
        .order("data", { ascending: true });
      return (data ?? []).map((r) => ({
        produto: r.produto as string,
        valor: Number(r.valor),
        data: r.data as string,
        fonte: r.fonte as CommodityRow["fonte"],
        fonte_url: r.fonte_url as string | null,
        unidade_id: r.unidade_id as string | null,
        moeda: r.moeda as CommodityRow["moeda"],
      }));
    },
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

  const cotacoesForConvert = useMemo(
    () =>
      (dolar ?? []).map((r) => ({
        tipo: r.tipo as DolarTipo,
        valor_brl: Number(r.valor_brl),
      })),
    [dolar],
  );

  const commodityGroups = useMemo(() => groupCommodityHistory(commodityRows ?? []), [commodityRows]);
  const dolarGroups = useMemo(() => groupDolarHistory(dolarHistory ?? []), [dolarHistory]);

  const formatValueInUserCurrency = (valorBRL: number) =>
    formatMoney(valorBRL, userMoeda, userDolarPref, cotacoesForConvert, i18n.language);

  const preferredDolarRow = dolar?.find((d) => d.tipo === userDolarPref);
  const preferredDolarHistory = dolarGroups.get(userDolarPref) ?? [];
  const preferredDolarVariation = computeVariation(preferredDolarHistory.map((h) => h.valor_brl));

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-2xl font-bold md:text-3xl">
          {t("dashboard.hello")}, {profile?.nome_completo?.split(" ")[0] ?? "👋"}
        </h1>
        <p className="text-sm text-muted-foreground">{t("dashboard.summary")}</p>
      </section>

      <BusinessDashboard />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{t("quote.title")}</h2>
          <Link
            to="/cotacao"
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {t("quote.viewAll")}
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        {(() => {
          const sel = prefs?.cotacoes_selecionadas ?? [];
          const featured = catalog
            .filter((c) => c.ativo)
            .filter((c) => (commodityGroups.get(c.codigo)?.length ?? 0) > 0)
            .filter((c) => (sel.length === 0 ? true : sel.includes(c.codigo)))
            .slice(0, PAINEL_MAX_FEATURED);

          if (featured.length === 0) {
            return (
              <p className="rounded-2xl border border-dashed border-border bg-card/30 p-6 text-center text-sm text-muted-foreground">
                {t("quote.emptyPainel")}
              </p>
            );
          }

          return (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {featured.map((c) => {
                const history = commodityGroups.get(c.codigo) ?? [];
                const latest = history[history.length - 1];
                const variation = computeVariation(history.map((h) => h.valor));
                return (
                  <Link
                    key={c.codigo}
                    to="/cotacao"
                    className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/60"
                  >
                    <div className="text-xs uppercase tracking-wide text-muted-foreground">
                      {nomeFor(c, i18n.language)}
                    </div>
                    <div className="mt-2 flex items-baseline justify-between gap-2">
                      <span className="font-display text-xl font-bold text-primary tabular-nums">
                        {latest ? formatValueInUserCurrency(latest.valor) : "—"}
                      </span>
                    </div>
                    <div className="mt-1">
                      <VariationBadge
                        variation={variation}
                        locale={i18n.language}
                        formatDelta={formatValueInUserCurrency}
                        size="sm"
                      />
                    </div>
                  </Link>
                );
              })}
            </div>
          );
        })()}

        {(() => {
          const vis = prefs?.tipos_dolar_visiveis ?? [];
          const show = vis.length === 0 || vis.includes(userDolarPref);
          if (!show || !preferredDolarRow) return null;
          return (
            <div className="mt-3">
              <Link
                to="/cotacao"
                className="group block rounded-2xl border border-primary/40 bg-card p-5 transition-colors hover:border-primary"
              >
                <div className="text-xs uppercase tracking-wide text-primary/90">
                  {t("quote.dollarTitle")} · {t(`quote.${userDolarPref}`)}
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-2">
                  <span className="font-display text-xl font-bold text-foreground tabular-nums">
                    {formatDolarValue(Number(preferredDolarRow.valor_brl), i18n.language)}
                  </span>
                </div>
                <div className="mt-1">
                  <VariationBadge
                    variation={preferredDolarVariation}
                    locale={i18n.language}
                    formatDelta={(v) => formatDolarValue(v, i18n.language)}
                    size="sm"
                  />
                </div>
              </Link>
            </div>
          );
        })()}
      </section>


      <section className="grid gap-4 md:grid-cols-2">
        <WeatherCard />
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
