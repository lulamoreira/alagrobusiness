import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useEffect, useRef } from "react";
import { ExternalLink, Star, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatMoney, formatDolarValue } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  computeVariation,
  filterRange,
  groupCommodityHistory,
  groupDolarHistory,
  type CommodityRow,
  type DolarHistoryRow,
} from "@/lib/quotes";
import { useCommoditiesCatalog, useQuotePreferences, nomeFor } from "@/lib/catalog";
import { Sparkline } from "@/components/Sparkline";
import { VariationBadge } from "@/components/VariationBadge";

export const Route = createFileRoute("/_authenticated/cotacao")({
  component: CotacaoPage,
});

type Range = 7 | 30;
type DolarTipo = "comercial" | "turismo" | "paralelo";
const ALL_DOLAR: DolarTipo[] = ["comercial", "turismo", "paralelo"];

function CotacaoPage() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const userMoeda = profile?.moeda_preferida ?? "BRL";
  const userDolarPref = (profile?.tipo_dolar_preferido ?? "comercial") as DolarTipo;

  const [commodityRange, setCommodityRange] = useState<Range>(7);
  const [dolarRange, setDolarRange] = useState<Range>(7);
  const [savingPrefs, setSavingPrefs] = useState(false);

  const { data: catalog = [] } = useCommoditiesCatalog();
  const { data: prefs } = useQuotePreferences(profile?.id);

  const [draftCommodities, setDraftCommodities] = useState<string[]>([]);
  const [draftDolar, setDraftDolar] = useState<string[]>([]);
  const seededRef = useRef(false);

  // Seed drafts once when preferences first load; do NOT clobber user edits on refetch.
  useEffect(() => {
    if (prefs && !seededRef.current) {
      setDraftCommodities(prefs.cotacoes_selecionadas);
      setDraftDolar(prefs.tipos_dolar_visiveis);
      seededRef.current = true;
    }
  }, [prefs]);

  const { data: commodityRows } = useQuery({
    queryKey: ["cotacoes_commodities_all"],
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

  const { data: dolarCurrent } = useQuery({
    queryKey: ["cotacoes_dolar"],
    queryFn: async () =>
      (await supabase.from("cotacoes_dolar").select("tipo, valor_brl, atualizado_em").is("deleted_at", null))
        .data ?? [],
  });

  const { data: unidades } = useQuery({
    queryKey: ["unidades_all"],
    queryFn: async () => (await supabase.from("unidades").select("id, nome_chave").is("deleted_at", null)).data ?? [],
    staleTime: 1000 * 60 * 30,
  });

  const cotacoesForConvert = useMemo(
    () =>
      (dolarCurrent ?? []).map((r) => ({
        tipo: r.tipo as DolarTipo,
        valor_brl: Number(r.valor_brl),
      })),
    [dolarCurrent],
  );

  const commodityGroups = useMemo(
    () => groupCommodityHistory(commodityRows ?? []),
    [commodityRows],
  );
  const dolarGroups = useMemo(() => groupDolarHistory(dolarHistory ?? []), [dolarHistory]);

  /** Commodities com cotação atual existente, filtradas por preferências. */
  const visibleCommodities = useMemo(() => {
    const sel = prefs?.cotacoes_selecionadas ?? [];
    return catalog
      .filter((c) => c.ativo)
      .filter((c) => (commodityGroups.get(c.codigo)?.length ?? 0) > 0)
      .filter((c) => (sel.length === 0 ? true : sel.includes(c.codigo)));
  }, [catalog, commodityGroups, prefs]);

  /** Tipos de dólar que possuem cotação atual (independente de visibilidade). */
  const dolarTiposWithData: DolarTipo[] = useMemo(() => {
    const set = new Set<DolarTipo>();
    (dolarCurrent ?? []).forEach((r) => set.add(r.tipo as DolarTipo));
    return ALL_DOLAR.filter((tipo) => set.has(tipo));
  }, [dolarCurrent]);

  /** Tipos de dólar visíveis (com dado) — filtrados pela seleção salva. Fallback: preferido. */
  const dolarTiposAvailable: DolarTipo[] = useMemo(() => {
    const vis = prefs?.tipos_dolar_visiveis ?? [];
    if (vis.length === 0) {
      return dolarTiposWithData.filter((t) => t === userDolarPref);
    }
    return dolarTiposWithData.filter((tipo) => vis.includes(tipo));
  }, [dolarTiposWithData, prefs, userDolarPref]);

  const formatValueInUserCurrency = (valorBRL: number) =>
    formatMoney(valorBRL, userMoeda, userDolarPref, cotacoesForConvert, i18n.language);

  const toggle = (arr: string[], setArr: (v: string[]) => void, code: string) => {
    setArr(arr.includes(code) ? arr.filter((c) => c !== code) : [...arr, code]);
  };

  const savePrefs = async () => {
    if (!profile?.id) return;
    setSavingPrefs(true);
    const { error } = await supabase
      .from("preferencias")
      .update({
        cotacoes_selecionadas: draftCommodities,
        tipos_dolar_visiveis: draftDolar,
      })
      .eq("usuario_id", profile.id);
    setSavingPrefs(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("quote.personalizeSaved"));
    qc.invalidateQueries({ queryKey: ["preferencias_cotacoes"] });
  };

  const clearPrefs = () => {
    setDraftCommodities([]);
    setDraftDolar([]);
  };

  /** Toggle direto (chips do topo) — persiste na hora em preferencias.tipos_dolar_visiveis. */
  const toggleDolarVisibility = async (tipo: DolarTipo) => {
    if (!profile?.id) return;
    const currentList = prefs?.tipos_dolar_visiveis ?? [];
    // Se lista vazia (fallback = preferido), tratar como se o preferido estivesse ativo.
    const effective = currentList.length === 0 ? [userDolarPref] : currentList;
    const next = effective.includes(tipo)
      ? effective.filter((t) => t !== tipo)
      : [...effective, tipo];
    // Reflete otimisticamente no draft para sincronizar checkboxes da Personalização.
    setDraftDolar(next);
    const { error } = await supabase
      .from("preferencias")
      .update({ tipos_dolar_visiveis: next })
      .eq("usuario_id", profile.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["preferencias_cotacoes"] });
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-2xl font-bold md:text-3xl">{t("quote.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("quote.subtitle")}</p>
      </header>

      {/* Personalização */}
      <section className="space-y-3 rounded-2xl border border-border bg-card/40 p-5 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-base font-bold">{t("quote.personalizeTitle")}</h2>
            <p className="text-xs text-muted-foreground">{t("quote.personalizeHint")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={clearPrefs}
              className="rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            >
              {t("quote.personalizeClear")}
            </button>
            <button
              type="button"
              onClick={savePrefs}
              disabled={savingPrefs}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {savingPrefs ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              {t("quote.personalizeSave")}
            </button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("quote.personalizeCommodities")}
          </p>
          <div className="flex flex-wrap gap-2">
            {catalog
              .filter((c) => c.ativo)
              .map((c) => {
                const active = draftCommodities.includes(c.codigo);
                return (
                  <button
                    key={c.codigo}
                    type="button"
                    onClick={() => toggle(draftCommodities, setDraftCommodities, c.codigo)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      active
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border bg-card text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {nomeFor(c, i18n.language)}
                  </button>
                );
              })}
          </div>
        </div>

        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("quote.personalizeDollar")}
          </p>
          <div className="flex flex-wrap gap-2">
            {ALL_DOLAR.map((tipo) => {
              const active = draftDolar.includes(tipo);
              return (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => toggle(draftDolar, setDraftDolar, tipo)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    active
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`quote.${tipo}`)}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Dollar */}
      {dolarTiposWithData.length > 0 && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold">{t("quote.dollarTitle")}</h2>
            <RangeToggle value={dolarRange} onChange={setDolarRange} />
          </div>

          <div className="flex flex-wrap gap-2">
            {dolarTiposWithData.map((tipo) => {
              const isVisible = dolarTiposAvailable.includes(tipo);
              return (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => toggleDolarVisibility(tipo)}
                  aria-pressed={isVisible}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    isVisible
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tipo === userDolarPref && <Star className="h-3 w-3 fill-primary text-primary" />}
                  {t(`quote.${tipo}`)}
                </button>
              );
            })}
          </div>


          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dolarTiposAvailable.map((tipo) => {
              const history = dolarGroups.get(tipo) ?? [];
              const current = (dolarCurrent ?? []).find((d) => d.tipo === tipo);
              const ranged = filterRange(history, dolarRange);
              const variation = computeVariation(history.map((h) => h.valor_brl));
              const isPreferred = tipo === userDolarPref;
              const isSelected = tipo === selectedDolar;

              return (
                <article
                  key={tipo}
                  className={cn(
                    "flex flex-col gap-3 rounded-2xl border bg-card p-5 transition-colors",
                    isPreferred ? "border-primary/60" : "border-border",
                  )}
                >
                  <header className="flex items-center justify-between gap-2">
                    <h3 className="font-display text-base font-bold">{t(`quote.${tipo}`)}</h3>
                    {isPreferred && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        <Star className="h-3 w-3 fill-primary" />
                        {t("quote.preferred")}
                      </span>
                    )}
                  </header>

                  {current && (
                    <>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-display text-2xl font-bold text-foreground tabular-nums">
                          {formatDolarValue(Number(current.valor_brl), i18n.language)}
                        </span>
                        <VariationBadge
                          variation={variation}
                          locale={i18n.language}
                          formatDelta={(v) => formatDolarValue(v, i18n.language)}
                        />
                      </div>

                      {isSelected && (
                        <Sparkline
                          points={ranged.map((r) => ({ data: r.data, value: r.valor_brl }))}
                          formatValue={(v) => formatDolarValue(v, i18n.language)}
                        />
                      )}

                      {current.atualizado_em && (
                        <p className="text-[10px] text-muted-foreground">
                          {t("quote.lastUpdate")}{" "}
                          {new Date(current.atualizado_em).toLocaleString(i18n.language)}
                        </p>
                      )}
                    </>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      {/* Commodities */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold">{t("quote.commoditiesTitle")}</h2>
          <RangeToggle value={commodityRange} onChange={setCommodityRange} />
        </div>

        {visibleCommodities.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card/30 p-6 text-center text-sm text-muted-foreground">
            {t("quote.emptyWithFilters")}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visibleCommodities.map((c) => {
              const history = commodityGroups.get(c.codigo) ?? [];
              const ranged = filterRange(history, commodityRange);
              const latest = history[history.length - 1];
              const unidade = unidades?.find((u) => u.id === latest?.unidade_id);
              const variation = computeVariation(history.map((h) => h.valor));

              return (
                <article
                  key={c.codigo}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5"
                >
                  <header className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-base font-bold text-foreground">
                        {nomeFor(c, i18n.language)}
                      </h3>
                      {unidade && (
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {t(`units.${unidade.nome_chave}`)}
                        </p>
                      )}
                    </div>
                    {latest?.fonte && (
                      <SourceBadge fonte={latest.fonte} fonteUrl={latest.fonte_url ?? undefined} />
                    )}
                  </header>

                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-display text-2xl font-bold text-primary tabular-nums">
                      {formatValueInUserCurrency(latest.valor)}
                    </span>
                    <VariationBadge
                      variation={variation}
                      locale={i18n.language}
                      formatDelta={formatValueInUserCurrency}
                    />
                  </div>

                  <Sparkline
                    points={ranged.map((r) => ({ data: r.data, value: r.valor }))}
                    formatValue={formatValueInUserCurrency}
                  />

                  <p className="text-[10px] text-muted-foreground">
                    {t("quote.lastUpdate")}{" "}
                    {new Date(latest.data).toLocaleDateString(i18n.language, {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}

function RangeToggle({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  const { t } = useTranslation();
  const options: { v: Range; label: string }[] = [
    { v: 7, label: t("quote.range7d") },
    { v: 30, label: t("quote.range30d") },
  ];
  return (
    <div className="inline-flex rounded-full border border-border bg-card p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          className={cn(
            "rounded-full px-3 py-1 text-xs font-medium transition-colors",
            value === o.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function SourceBadge({ fonte, fonteUrl }: { fonte: "manual" | "auto" | "ia"; fonteUrl?: string }) {
  const { t } = useTranslation();
  const label =
    fonte === "manual" ? t("quote.sourceManual") : fonte === "ia" ? t("quote.sourceIa") : t("quote.sourceAuto");
  const className = cn(
    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
    fonte === "manual"
      ? "bg-primary/15 text-primary"
      : fonte === "ia"
        ? "bg-purple-500/15 text-purple-300"
        : "bg-muted text-muted-foreground",
  );
  if (fonte === "ia" && fonteUrl) {
    return (
      <a href={fonteUrl} target="_blank" rel="noreferrer noopener" className={className} title={fonteUrl}>
        {label}
        <ExternalLink className="h-2.5 w-2.5" />
      </a>
    );
  }
  return <span className={className}>{label}</span>;
}
