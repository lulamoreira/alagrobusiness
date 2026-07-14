import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AnuncioCard, type AnuncioCardData } from "@/components/AnuncioCard";
import { listCountries, countryName } from "@/lib/countries";
import type { CambioRow } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/internacional")({ component: InternationalPage });

function InternationalPage() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const [pais, setPais] = useState<string>("");

  const { data: anuncios, isLoading } = useQuery({
    queryKey: ["intl_anuncios"],
    queryFn: async () => {
      const { data } = await supabase
        .from("anuncios")
        .select("*")
        .eq("status", "ativo")
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .eq("para_exportacao" as any, true)
        .is("deleted_at", null)
        .order("destaque_ate", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(120);
      return (data ?? []) as unknown as AnuncioCardData[];
    },
  });

  const { data: units } = useQuery({
    queryKey: ["unidades_all"],
    queryFn: async () => (await supabase.from("unidades").select("*").is("deleted_at", null)).data ?? [],
    staleTime: 1000 * 60 * 30,
  });

  const { data: cambio } = useQuery({
    queryKey: ["cotacoes_cambio"],
    queryFn: async (): Promise<CambioRow[]> =>
      ((await supabase.from("cotacoes_cambio").select("moeda, valor_brl")).data ?? []) as CambioRow[],
    staleTime: 1000 * 60 * 10,
  });
  void cambio;

  const filtered = useMemo(() => {
    let list = anuncios ?? [];
    if (pais) {
      list = list.filter((a) => (a.paises_destino ?? []).includes(pais));
    }
    return list;
  }, [anuncios, pais]);

  const countries = useMemo(() => listCountries(i18n.language), [i18n.language]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2 font-display text-2xl font-bold md:text-3xl">
            <Globe className="h-6 w-6 text-primary" />
            {t("international.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("international.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">
            {t("international.filterCountry")}
          </label>
          <select
            value={pais}
            onChange={(e) => setPais(e.target.value)}
            className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
          >
            <option value="">{t("international.allCountries")}</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-border bg-card/40 p-6 text-center text-sm text-muted-foreground">
          {t("international.noResults")}
        </p>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            {t("international.results", { count: filtered.length })}
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((a) => (
              <div key={a.id} className="space-y-1">
                <AnuncioCard item={a} units={units ?? []} cotacoes={[]} />
                {(a.incoterm || (a.paises_destino ?? []).length > 0) && (
                  <div className="flex flex-wrap items-center gap-1 px-1 text-[10px] text-muted-foreground">
                    {a.incoterm && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold uppercase text-primary">
                        {a.incoterm}
                      </span>
                    )}
                    {(a.paises_destino ?? []).slice(0, 4).map((c) => (
                      <span key={c} className="rounded-full border border-border bg-background/60 px-2 py-0.5">
                        {countryName(c, i18n.language)}
                      </span>
                    ))}
                    {(a.paises_destino ?? []).length > 4 && (
                      <span className="text-muted-foreground">+{(a.paises_destino ?? []).length - 4}</span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {!profile?.pais && (
        <p className="text-[11px] text-muted-foreground">
          {t("international.setYourCountryHint")}
        </p>
      )}
    </div>
  );
}
