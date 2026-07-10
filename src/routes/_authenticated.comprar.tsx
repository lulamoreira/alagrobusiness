import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { DarkInput } from "@/components/DarkInput";
import { AnuncioCard, type AnuncioCardData } from "@/components/AnuncioCard";
import { CatalogoCascade } from "@/components/CatalogoCascade";
import { fetchCatalogoAll, catalogoSubtreeIds } from "@/lib/catalogo";
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

  const { data: anuncios, isLoading } = useQuery({
    queryKey: ["buy_anuncios"],
    queryFn: async () =>
      (
        await supabase
          .from("anuncios")
          .select("*")
          .eq("status", "ativo")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(120)
      ).data ?? [],
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

    if (sort === "asc") list = [...list].sort((a, b) => Number(a.preco) - Number(b.preco));
    else if (sort === "desc") list = [...list].sort((a, b) => Number(b.preco) - Number(a.preco));
    return list;
  }, [anuncios, search, catalogoFilter, catalogoNodes, state, quality, certs, acceptsBarter, delivery, priceMin, priceMax, sort]);

  const clearFilters = () => {
    setCatalogoFilter(null);

    setState("");
    setQuality("");
    setCerts([]);
    setAcceptsBarter(null);
    setDelivery(null);
    setPriceMin("");
    setPriceMax("");
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
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">{t("buy.noResults")}</p>
        </div>
      ) : (
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
      )}
    </div>
  );
}
