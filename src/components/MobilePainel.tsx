import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  ArrowRight,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudRain,
  CloudSnow,
  CloudSun,
  HelpCircle,
  Sun,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatMoney, formatMoneyCompact, formatDolarValue } from "@/lib/format";
import {
  computeVariation,
  groupCommodityHistory,
  groupDolarHistory,
  type CommodityRow,
  type DolarHistoryRow,
} from "@/lib/quotes";
import { useCommoditiesCatalog, useQuotePreferences, nomeFor } from "@/lib/catalog";
import { VariationBadge } from "@/components/VariationBadge";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { useMeusClimaLocais } from "@/components/WeatherCard";
import { buildRegiaoKey } from "@/lib/climaLocais";

type DolarTipo = "comercial" | "turismo" | "paralelo";

const WEATHER_ICONS: Record<string, LucideIcon> = {
  "weather.clear": Sun,
  "weather.partlyCloudy": CloudSun,
  "weather.cloudy": Cloud,
  "weather.fog": CloudFog,
  "weather.drizzle": CloudDrizzle,
  "weather.rain": CloudRain,
  "weather.snow": CloudSnow,
  "weather.thunderstorm": Zap,
  "weather.unknown": HelpCircle,
};

function formatVolume(totalKg: number, t: (k: string) => string, locale: string) {
  if (totalKg <= 0) return `0 ${t("dashboard.business.kg")}`;
  if (totalKg >= 1000) {
    const tons = totalKg / 1000;
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(tons)} ${t(
      "dashboard.business.ton",
    )}`;
  }
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(totalKg)} ${t(
    "dashboard.business.kg",
  )}`;
}

function MiniKpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 font-display text-base font-bold tabular-nums text-foreground truncate">
        {value}
      </div>
    </div>
  );
}

function BusinessMobile() {
  const { t, i18n } = useTranslation();
  const { user, profile } = useAuth();
  const userMoeda = (profile?.moeda_preferida ?? "BRL") as "BRL" | "USD" | "EUR";
  const userDolarPref = (profile?.tipo_dolar_preferido ?? "comercial") as DolarTipo;

  const { data: dolar } = useQuery({
    queryKey: ["cotacoes_dolar"],
    queryFn: async () =>
      (await supabase.from("cotacoes_dolar").select("tipo, valor_brl")).data ?? [],
    staleTime: 1000 * 60 * 30,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["business_kpis", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [anunciosRes, unidadesRes, vendasRes] = await Promise.all([
        supabase
          .from("anuncios")
          .select("id, status, quantidade_disponivel, quantidade_unidade_id")
          .eq("vendedor_id", user!.id)
          .is("deleted_at", null),
        supabase.from("unidades").select("id, fator_kg").is("deleted_at", null),
        supabase
          .from("vendas")
          .select("valor_total, moeda, status_pagamento")
          .eq("vendedor_id", user!.id)
          .is("deleted_at", null),
      ]);
      const anuncios = anunciosRes.data ?? [];
      const unidades = unidadesRes.data ?? [];
      const vendas = vendasRes.data ?? [];
      const ativos = anuncios.filter((a) => a.status === "ativo");
      const vendidos = anuncios.filter((a) => a.status === "vendido");
      const fatorById = new Map<string, number>(
        unidades.map((u) => [u.id as string, Number(u.fator_kg) || 0]),
      );
      let volumeKg = 0;
      for (const a of ativos) {
        const f = fatorById.get(a.quantidade_unidade_id as string) ?? 0;
        volumeKg += Number(a.quantidade_disponivel) * f;
      }
      let conversasCount = 0;
      if (ativos.length > 0) {
        const ids = ativos.map((a) => a.id as string);
        const { data: conv } = await supabase
          .from("conversas")
          .select("id, status_negociacao")
          .in("anuncio_id", ids)
          .in("status_negociacao", ["iniciado", "em_negociacao"])
          .is("deleted_at", null);
        conversasCount = (conv ?? []).length;
      }
      const brlVendas = vendas.filter((v) => (v.moeda as string) === "BRL");
      const totalBRL = brlVendas.reduce((acc, v) => acc + Number(v.valor_total), 0);
      const pendingBRL = brlVendas
        .filter((v) => (v.status_pagamento as string) === "aguardando")
        .reduce((acc, v) => acc + Number(v.valor_total), 0);
      return {
        listedCount: ativos.length,
        soldCount: vendidos.length,
        volumeKg,
        negotiatingCount: conversasCount,
        revenueBRL: totalBRL,
        pendingBRL,
        totalListings: anuncios.length,
      };
    },
  });

  const nf = new Intl.NumberFormat(i18n.language);

  if (isLoading || !data) {
    return <p className="text-xs text-muted-foreground">{t("common.loading")}</p>;
  }

  if (data.totalListings === 0) {
    return (
      <p className="text-xs text-muted-foreground">{t("dashboard.business.emptyDescription")}</p>
    );
  }

  const revenue = formatMoneyCompact(
    data.revenueBRL,
    userMoeda,
    userDolarPref,
    dolar ?? [],
    i18n.language,
  );
  const revenueFull = formatMoney(
    data.revenueBRL,
    userMoeda,
    userDolarPref,
    dolar ?? [],
    i18n.language,
  );
  const pendingCompact = formatMoneyCompact(
    data.pendingBRL,
    userMoeda,
    userDolarPref,
    dolar ?? [],
    i18n.language,
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MiniKpi label={t("dashboard.business.productsListed")} value={nf.format(data.listedCount)} />
        <MiniKpi
          label={t("dashboard.business.volumeListed")}
          value={formatVolume(data.volumeKg, t, i18n.language)}
        />
        <MiniKpi label={t("dashboard.business.sold")} value={nf.format(data.soldCount)} />
        <MiniKpi
          label={t("dashboard.business.inNegotiation")}
          value={nf.format(data.negotiatingCount)}
        />
      </div>
      <div
        title={revenueFull}
        className="rounded-xl border border-primary/40 bg-primary/10 p-3"
      >
        <div className="text-[10px] font-semibold uppercase tracking-wider text-primary/90">
          {t("dashboard.business.revenue")}
        </div>
        <div className="mt-1 font-display text-xl font-bold tabular-nums text-primary truncate">
          {revenue}
        </div>
        {data.pendingBRL > 0 && (
          <div className="mt-0.5 text-[11px] font-medium text-muted-foreground tabular-nums truncate">
            {t("dashboard.business.pendingHint", { value: pendingCompact })}
          </div>
        )}
      </div>
    </div>
  );
}

function QuotesMobile() {
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

  const cotacoesForConvert = useMemo(
    () =>
      (dolar ?? []).map((r) => ({
        tipo: r.tipo as DolarTipo,
        valor_brl: Number(r.valor_brl),
      })),
    [dolar],
  );
  const commodityGroups = useMemo(
    () => groupCommodityHistory(commodityRows ?? []),
    [commodityRows],
  );
  const dolarGroups = useMemo(() => groupDolarHistory(dolarHistory ?? []), [dolarHistory]);

  const formatValueInUserCurrency = (v: number) =>
    formatMoney(v, userMoeda, userDolarPref, cotacoesForConvert, i18n.language);

  const sel = prefs?.cotacoes_selecionadas ?? [];
  const featured = catalog
    .filter((c) => c.ativo)
    .filter((c) => (commodityGroups.get(c.codigo)?.length ?? 0) > 0)
    .filter((c) => (sel.length === 0 ? true : sel.includes(c.codigo)));

  const vis = (prefs?.tipos_dolar_visiveis ?? []) as DolarTipo[];
  const tiposToShow: DolarTipo[] = vis.length > 0 ? vis : [userDolarPref];
  const dolarCards = tiposToShow
    .map((tipo) => {
      const row = dolar?.find((d) => d.tipo === tipo);
      if (!row) return null;
      const history = dolarGroups.get(tipo) ?? [];
      const variation = computeVariation(history.map((h) => h.valor_brl));
      return { tipo, valor: Number(row.valor_brl), variation };
    })
    .filter((x): x is { tipo: DolarTipo; valor: number; variation: ReturnType<typeof computeVariation> } => x !== null);

  if (featured.length === 0 && dolarCards.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">{t("quote.emptyPainel")}</p>
    );
  }

  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
      {dolarCards.map((card) => (
        <Link
          key={card.tipo}
          to="/cotacao"
          className="min-w-[9rem] shrink-0 snap-start rounded-xl border border-primary/40 bg-card p-3"
        >
          <div className="truncate text-[10px] uppercase tracking-wide text-primary/90">
            {t("quote.dollarTitle")} · {t(`quote.${card.tipo}`)}
          </div>
          <div className="mt-1 font-display text-base font-bold text-foreground tabular-nums truncate">
            {formatDolarValue(card.valor, i18n.language)}
          </div>
          <div className="mt-1">
            <VariationBadge
              variation={card.variation}
              locale={i18n.language}
              formatDelta={(v) => formatDolarValue(v, i18n.language)}
              size="sm"
            />
          </div>
        </Link>
      ))}
      {featured.map((c) => {
        const history = commodityGroups.get(c.codigo) ?? [];
        const latest = history[history.length - 1];
        const variation = computeVariation(history.map((h) => h.valor));
        return (
          <Link
            key={c.codigo}
            to="/cotacao"
            className="min-w-[9rem] shrink-0 snap-start rounded-xl border border-border bg-card p-3"
          >
            <div className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
              {nomeFor(c, i18n.language)}
            </div>
            <div className="mt-1 font-display text-base font-bold text-primary tabular-nums truncate">
              {latest ? formatValueInUserCurrency(latest.valor) : "—"}
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
}


type PrevisaoDia = {
  data: string;
  min: number | null;
  max: number | null;
  weather_code: number | null;
  condicao: string;
};
type ClimaRow = {
  regiao: string;
  temperatura: number | null;
  condicao: string | null;
  previsao: PrevisaoDia[] | null;
  atualizado_em: string;
};

function WeatherMobile() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const meus = useMeusClimaLocais();

  const fallbackRegiao = buildRegiaoKey(profile?.cidade, profile?.estado);
  const locais =
    (meus.data ?? []).length > 0
      ? (meus.data ?? []).map((l) => ({ id: l.id, regiao: l.regiao }))
      : fallbackRegiao
        ? [{ id: "profile", regiao: fallbackRegiao }]
        : [];

  const { data: climaMap, isLoading } = useQuery({
    queryKey: ["clima_multi_mobile", locais.map((l) => l.regiao).sort().join("|")],
    enabled: locais.length > 0,
    queryFn: async (): Promise<Record<string, ClimaRow>> => {
      const { data } = await supabase
        .from("clima")
        .select("regiao, temperatura, condicao, previsao, atualizado_em")
        .in("regiao", locais.map((l) => l.regiao))
        .is("deleted_at", null)
        .order("atualizado_em", { ascending: false });
      const out: Record<string, ClimaRow> = {};
      for (const row of data ?? []) {
        const r = row.regiao as string;
        if (out[r]) continue;
        out[r] = {
          regiao: r,
          temperatura: row.temperatura != null ? Number(row.temperatura) : null,
          condicao: (row.condicao as string | null) ?? null,
          previsao: (row.previsao as unknown as PrevisaoDia[] | null) ?? null,
          atualizado_em: row.atualizado_em as string,
        };
      }
      return out;
    },
  });

  const nf = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 });

  if (locais.length === 0) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t("weather.noRegion")}</p>
        <Link to="/configuracoes" className="text-xs font-semibold text-primary">
          {t("weather.addLocation")}
        </Link>
      </div>
    );
  }
  if (isLoading) return <div className="h-14 animate-pulse rounded-lg bg-muted/30" />;

  return (
    <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
      {locais.map((l) => {
        const data = climaMap?.[l.regiao];
        const condKey = data?.condicao ?? "weather.unknown";
        const Icon = WEATHER_ICONS[condKey] ?? HelpCircle;
        const today = (data?.previsao ?? [])[0];
        return (
          <div
            key={l.id}
            className="min-w-[16rem] shrink-0 snap-start rounded-xl border border-border bg-card p-3"
          >
            <div className="flex items-center gap-3">
              <Icon className="h-8 w-8 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-foreground">{l.regiao}</div>
                <div className="truncate text-[11px] text-muted-foreground">
                  {data?.temperatura == null ? t("weather.empty") : t(condKey)}
                </div>
              </div>
              <div className="text-right">
                <div className="font-display text-xl font-bold tabular-nums leading-none">
                  {data?.temperatura != null ? `${nf.format(Math.round(data.temperatura))}°` : "—"}
                </div>
                {today && (today.max != null || today.min != null) && (
                  <div className="mt-1 text-[10px] tabular-nums text-muted-foreground">
                    {today.max != null ? `${nf.format(Math.round(today.max))}°` : "—"}{" "}
                    {today.min != null ? `${nf.format(Math.round(today.min))}°` : "—"}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


interface NewsRow {
  id: string;
  titulo: string;
  link: string;
  fonte: string | null;
  imagem: string | null;
  tema: string | null;
  publicado_em: string | null;
}

function NewsMobile() {
  const { t, i18n } = useTranslation();
  const { data } = useQuery({
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

  const items = ((data ?? []) as NewsRow[]).slice(0, 3);

  if (items.length === 0) {
    return <p className="text-xs text-muted-foreground">{t("dashboard.noNews")}</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((n) => {
        const date = n.publicado_em
          ? new Date(n.publicado_em).toLocaleDateString(i18n.language, {
              day: "2-digit",
              month: "short",
            })
          : "";
        return (
          <li key={n.id} className="py-2 first:pt-0 last:pb-0">
            <a
              href={n.link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-3"
            >
              {n.imagem ? (
                <img
                  src={n.imagem}
                  alt=""
                  loading="lazy"
                  className="h-14 w-14 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="h-14 w-14 shrink-0 rounded-lg bg-muted/40" />
              )}
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {n.tema && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-primary">
                      {n.tema}
                    </span>
                  )}
                </div>
                <h3 className="line-clamp-2 text-xs font-semibold text-foreground">{n.titulo}</h3>
                <div className="mt-0.5 text-[10px] text-muted-foreground truncate">
                  {n.fonte ? `${n.fonte}` : ""}
                  {n.fonte && date ? " · " : ""}
                  {date}
                </div>
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

function ViewAllLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      onClick={(e) => e.stopPropagation()}
      className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
    >
      {label}
      <ArrowRight className="h-3 w-3" />
    </Link>
  );
}

export function MobilePainel() {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <CollapsibleSection id="business" title={t("dashboard.business.title")}>
        <BusinessMobile />
      </CollapsibleSection>

      <CollapsibleSection
        id="quotes"
        title={t("quote.title")}
        right={<ViewAllLink to="/cotacao" label={t("quote.viewAll")} />}
      >
        <QuotesMobile />
      </CollapsibleSection>

      <CollapsibleSection id="weather" title={t("weather.title")}>
        <WeatherMobile />
      </CollapsibleSection>

      <CollapsibleSection
        id="news"
        title={t("dashboard.news")}
        right={<ViewAllLink to="/noticias" label={t("quote.viewAll")} />}
      >
        <NewsMobile />
      </CollapsibleSection>
    </div>
  );
}
