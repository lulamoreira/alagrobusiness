import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { DarkInput } from "@/components/DarkInput";
import { AnuncioCard, type AnuncioCardData } from "@/components/AnuncioCard";
import { CatalogoCascade } from "@/components/CatalogoCascade";
import { fetchCatalogoAll, catalogoSubtreeIds } from "@/lib/catalogo";
import { distanceKm } from "@/lib/geo";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/_authenticated/comprar")({ component: BuyPage });


const DELIVERY_MODES = ["retirada", "entrega", "ambos"] as const;
const CERTIFICATIONS = ["organico", "globalgap", "livre_agrotoxico", "rainforest"] as const;

type SortKey = "recent" | "asc" | "desc";

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-all",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function BuyPage() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [catalogoFilter, setCatalogoFilter] = useState<string | null>(null);
  const [state, setState] = useState("");

  const [quality, setQuality] = useState("");
  const [certs, setCerts] = useState<string[]>([]);
  const [acceptsBarter, setAcceptsBarter] = useState<boolean | null>(null);
  const [delivery, setDelivery] = useState<string | null>(null);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sort, setSort] = useState<SortKey>("recent");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [cdFilter, setCdFilter] = useState<string | null>(null);
  const [nearMe, setNearMe] = useState(false);
  const [radiusKm, setRadiusKm] = useState("150");

  const buyerLat = profile?.latitude ?? null;
  const buyerLng = profile?.longitude ?? null;
  const hasLocation = buyerLat != null && buyerLng != null;

  const { data: startupIds } = useQuery({
    queryKey: ["startup_pme_seller_ids"],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: async (): Promise<string[]> => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("id")
        .eq("tipo_perfil", "startup_pme")
        .is("deleted_at", null);
      return (data ?? []).map((r: { id: string }) => r.id);
    },
    staleTime: 1000 * 60 * 5,
  });

  const { data: anuncios, isLoading } = useQuery({
    queryKey: ["buy_anuncios", (startupIds ?? []).join(",")],
    enabled: startupIds !== undefined,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      let q = supabase
        .from("anuncios")
        .select("*")
        .eq("status", "ativo")
        .is("deleted_at", null);
      const ids = startupIds ?? [];
      // Exclude ads belonging to the Startups module UNLESS currently featured.
      // Belongs to Startups module = seller is startup_pme OR em_startups=true.
      if (ids.length > 0) {
        q = q.or(
          `and(vendedor_id.not.in.(${ids.join(",")}),em_startups.eq.false),destaque_ate.gt.${nowIso}`,
        );
      } else {
        q = q.or(`em_startups.eq.false,destaque_ate.gt.${nowIso}`);
      }
      const { data } = await q
        .order("destaque_ate", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(120);
      return data ?? [];
    },
  });



  const { data: cotacoes } = useQuery({
    queryKey: ["cotacoes_dolar"],
    queryFn: async () => (await supabase.from("cotacoes_dolar").select("tipo, valor_brl")).data ?? [],
    staleTime: 1000 * 60 * 30,
  });
  const { data: catalogoNodes } = useQuery({
    queryKey: ["catalogo_all_active"],
    queryFn: () => fetchCatalogoAll(false),
    staleTime: 1000 * 60 * 10,
  });


  const { data: unidades } = useQuery({
    queryKey: ["unidades_all"],
    queryFn: async () =>
      (await supabase.from("unidades").select("*").is("deleted_at", null)).data ?? [],
    staleTime: 1000 * 60 * 30,
  });

  const { data: cds } = useQuery({
    queryKey: ["cds_ativos_comprar"],
    queryFn: async () =>
      (
        await supabase
          .from("centros_distribuicao")
          .select("id, nome, cidade, estado, latitude, longitude")
          .eq("ativo", true)
          .is("deleted_at", null)
          .order("nome", { ascending: true })
      ).data ?? [],
    staleTime: 1000 * 60 * 5,
  });

  const anuncioIds = useMemo(
    () => (anuncios ?? []).map((a) => a.id),
    [anuncios],
  );

  const { data: anuncioCentrosLinks } = useQuery({
    queryKey: ["anuncio_centros_map", anuncioIds.join(",")],
    enabled: anuncioIds.length > 0,
    queryFn: async () =>
      (
        await supabase
          .from("anuncio_centros")
          .select("anuncio_id, centro_id")
          .in("anuncio_id", anuncioIds)
      ).data ?? [],
  });

  const anuncioToCds = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const link of anuncioCentrosLinks ?? []) {
      const cur = map.get(link.anuncio_id) ?? [];
      cur.push(link.centro_id);
      map.set(link.anuncio_id, cur);
    }
    return map;
  }, [anuncioCentrosLinks]);

  const cdsWithDistance = useMemo(() => {
    const list = (cds ?? []).map((c) => ({
      ...c,
      km: hasLocation ? distanceKm(buyerLat, buyerLng, c.latitude, c.longitude) : null,
    }));
    if (hasLocation) {
      list.sort((a, b) => {
        const ax = a.km ?? Number.POSITIVE_INFINITY;
        const bx = b.km ?? Number.POSITIVE_INFINITY;
        return ax - bx;
      });
    }
    return list;
  }, [cds, hasLocation, buyerLat, buyerLng]);

  const radiusNum = Number(radiusKm) || 0;
  const nearbyCdIds = useMemo(() => {
    if (!nearMe || !hasLocation) return null;
    return new Set(
      cdsWithDistance.filter((c) => c.km != null && c.km <= radiusNum).map((c) => c.id),
    );
  }, [nearMe, hasLocation, cdsWithDistance, radiusNum]);

  const cdOptions = useMemo(
    () => (nearbyCdIds ? cdsWithDistance.filter((c) => nearbyCdIds.has(c.id)) : cdsWithDistance),
    [cdsWithDistance, nearbyCdIds],
  );

  const vendedorIds = useMemo(
    () => Array.from(new Set((anuncios ?? []).map((a) => a.vendedor_id))),
    [anuncios],
  );

  const { data: vendedores } = useQuery({
    queryKey: ["buy_sellers", vendedorIds.join(",")],
    queryFn: async () =>
      vendedorIds.length === 0
        ? []
        : ((await supabase.from("profiles").select("id, nome_completo").in("id", vendedorIds)).data ?? []),
    enabled: vendedorIds.length > 0,
  });

  const filtered = useMemo(() => {
    let list = (anuncios ?? []) as AnuncioCardData[];
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.titulo.toLowerCase().includes(q) ||
          a.produto.toLowerCase().includes(q),
      );
    }
    
    if (catalogoFilter && catalogoNodes) {
      const allowed = new Set(catalogoSubtreeIds(catalogoNodes, catalogoFilter));
      list = list.filter((a) => {
        const cid = (a as unknown as { catalogo_item_id?: string | null }).catalogo_item_id;
        return cid ? allowed.has(cid) : false;
      });
    }

    if (state.trim()) list = list.filter((a) => (a.estado ?? "").toLowerCase().includes(state.trim().toLowerCase()));
    if (quality.trim()) list = list.filter((a) => (a.qualidade ?? "").toLowerCase().includes(quality.trim().toLowerCase()));
    if (certs.length > 0) list = list.filter((a) => certs.every((c) => a.certificacoes?.includes(c)));
    if (acceptsBarter !== null) list = list.filter((a) => a.aceita_permuta === acceptsBarter);
    if (delivery) list = list.filter((a) => (a as unknown as { modalidade_entrega: string }).modalidade_entrega === delivery);
    if (priceMin) list = list.filter((a) => Number(a.preco) >= Number(priceMin));
    if (priceMax) list = list.filter((a) => Number(a.preco) <= Number(priceMax));

    if (cdFilter) {
      list = list.filter((a) => (anuncioToCds.get(a.id) ?? []).includes(cdFilter));
    }
    if (nearbyCdIds) {
      list = list.filter((a) => {
        const linked = anuncioToCds.get(a.id) ?? [];
        return linked.some((cid) => nearbyCdIds.has(cid));
      });
    }

    if (sort === "asc") list = [...list].sort((a, b) => Number(a.preco) - Number(b.preco));
    else if (sort === "desc") list = [...list].sort((a, b) => Number(b.preco) - Number(a.preco));
    return list;
  }, [anuncios, search, catalogoFilter, catalogoNodes, state, quality, certs, acceptsBarter, delivery, priceMin, priceMax, sort, cdFilter, nearbyCdIds, anuncioToCds]);

  const clearFilters = () => {
    setCatalogoFilter(null);

    setState("");
    setQuality("");
    setCerts([]);
    setAcceptsBarter(null);
    setDelivery(null);
    setPriceMin("");
    setPriceMax("");
    setCdFilter(null);
    setNearMe(false);
  };

  const toggleCert = (c: string) =>
    setCerts((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">{t("buy.title")}</h1>
          <p className="text-xs text-muted-foreground">
            {t("buy.results", { count: filtered.length })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground outline-none focus:border-primary"
          >
            <option value="recent">{t("buy.sortRecent")}</option>
            <option value="asc">{t("buy.sortPriceAsc")}</option>
            <option value="desc">{t("buy.sortPriceDesc")}</option>
          </select>
          <button
            type="button"
            onClick={() => setFiltersOpen((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium hover:bg-accent"
          >
            <SlidersHorizontal className="h-4 w-4" />
            {t("buy.filters")}
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <DarkInput
          className="pl-10"
          placeholder={t("buy.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtersOpen && (
        <div className="space-y-4 rounded-2xl border border-border bg-card/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">{t("buy.filters")}</p>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" /> {t("buy.clearFilters")}
            </button>
          </div>

          <CatalogoCascade
            label={t("buy.filterCategory")}
            value={catalogoFilter}
            onChange={setCatalogoFilter}
            tipoFilter="produto"
            allowClear
          />



          <div className="grid gap-3 md:grid-cols-3">
            <DarkInput label={t("buy.filterState")} value={state} onChange={(e) => setState(e.target.value)} />
            <DarkInput label={t("buy.filterQuality")} value={quality} onChange={(e) => setQuality(e.target.value)} />
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">{t("buy.filterDeliveryMode")}</label>
              <div className="flex flex-wrap gap-2">
                <Chip active={delivery === null} onClick={() => setDelivery(null)}>{t("common.all")}</Chip>
                {DELIVERY_MODES.map((m) => (
                  <Chip key={m} active={delivery === m} onClick={() => setDelivery(m)}>
                    {t(`delivery.${m}`)}
                  </Chip>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">{t("buy.filterCertifications")}</label>
            <div className="flex flex-wrap gap-2">
              {CERTIFICATIONS.map((c) => (
                <Chip key={c} active={certs.includes(c)} onClick={() => toggleCert(c)}>
                  {t(`cert.${c}`)}
                </Chip>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">{t("buy.filterAcceptsBarter")}</label>
              <div className="flex flex-wrap gap-2">
                <Chip active={acceptsBarter === null} onClick={() => setAcceptsBarter(null)}>{t("common.all")}</Chip>
                <Chip active={acceptsBarter === true} onClick={() => setAcceptsBarter(true)}>{t("common.yes")}</Chip>
                <Chip active={acceptsBarter === false} onClick={() => setAcceptsBarter(false)}>{t("common.no")}</Chip>
              </div>
            </div>
            <DarkInput
              label={t("buy.filterPriceMin")}
              type="number"
              value={priceMin}
              onChange={(e) => setPriceMin(e.target.value)}
            />
            <DarkInput
              label={t("buy.filterPriceMax")}
              type="number"
              value={priceMax}
              onChange={(e) => setPriceMax(e.target.value)}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-[2fr_auto_1fr]">
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">
                {t("buy.cdFilter")}
              </label>
              <select
                value={cdFilter ?? ""}
                onChange={(e) => setCdFilter(e.target.value || null)}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground outline-none focus:border-primary"
              >
                <option value="">{t("buy.cdAll")}</option>
                {cdOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.km != null
                      ? t("buy.cdOptionWithKm", {
                          nome: c.nome,
                          cidade: c.cidade ?? "—",
                          estado: c.estado ?? "—",
                          km: c.km.toFixed(0),
                        })
                      : t("buy.cdOption", {
                          nome: c.nome,
                          cidade: c.cidade ?? "—",
                          estado: c.estado ?? "—",
                        })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">
                {t("buy.nearMe")}
              </label>
              <button
                type="button"
                disabled={!hasLocation}
                onClick={() => setNearMe((v) => !v)}
                className={cn(
                  "rounded-full border px-3 py-2 text-xs font-medium transition-all",
                  nearMe
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-muted-foreground hover:text-foreground",
                  !hasLocation && "cursor-not-allowed opacity-50",
                )}
              >
                {t("buy.nearMe")}
              </button>
            </div>
            <DarkInput
              label={t("buy.radiusKm")}
              type="number"
              value={radiusKm}
              onChange={(e) => setRadiusKm(e.target.value)}
              disabled={!hasLocation || !nearMe}
            />
          </div>
          {!hasLocation && (
            <p className="text-xs text-muted-foreground">{t("buy.needLocationHint")}</p>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">{t("buy.noResults")}</p>
        </div>
      ) : (
        <>
          {(() => {
            const now = Date.now();
            const featured = ((anuncios ?? []) as AnuncioCardData[]).filter(
              (a) => a.destaque_ate && new Date(a.destaque_ate).getTime() > now,
            );
            if (featured.length === 0) return null;
            return (
              <section className="space-y-3">
                <h2 className="font-display text-lg font-semibold md:text-xl">
                  {t("buy.featuredTitle")}
                </h2>
                <div className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2">
                  {featured.map((a) => (
                    <div key={a.id} className="w-72 shrink-0 snap-start md:w-80">
                      <AnuncioCard
                        item={a}
                        units={unidades ?? []}
                        cotacoes={cotacoes ?? []}
                        sellerName={vendedores?.find((v) => v.id === a.vendedor_id)?.nome_completo}
                      />
                    </div>
                  ))}
                </div>
              </section>
            );
          })()}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((a) => (
              <AnuncioCard
                key={a.id}
                item={a}
                units={unidades ?? []}
                cotacoes={cotacoes ?? []}
                sellerName={vendedores?.find((v) => v.id === a.vendedor_id)?.nome_completo}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
