import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Repeat2, BadgeCheck, Sprout, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/storage";
import { formatPrice, type CambioRow } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { fetchCatalogoAll, catalogoPathLabel } from "@/lib/catalogo";
import { toUF } from "@/lib/brStates";

export interface AnuncioCardData {
  id: string;
  titulo: string;
  produto: string;
  preco: number;
  moeda: "BRL" | "USD" | "EUR";
  preco_unidade_id: string;
  quantidade_disponivel: number;
  quantidade_unidade_id: string;
  estado: string | null;
  cidade: string | null;
  qualidade: string | null;
  data_colheita: string | null;
  fotos: string[];
  aceita_permuta: boolean;
  certificacoes: string[];
  vendedor_id: string;
  catalogo_item_id?: string | null;
  tipo_oferta?: "produto" | "servico" | null;
  servico_modelo_cobranca?: "hora" | "projeto" | "mensal" | null;
  servico_area_atuacao?: string | null;
  servico_prazo?: string | null;
  destaque_ate?: string | null;
}


interface AnuncioCardProps {
  item: AnuncioCardData;
  units: { id: string; nome_chave: string }[];
  cotacoes: { tipo: "comercial" | "turismo" | "paralelo"; valor_brl: number }[];
  sellerName?: string;
  sellerTipoPerfil?: string | null;
  hasCd?: boolean;
  /** Compact layout used by carousels: numeric date, UF only, no seller name, fills height. */
  compact?: boolean;
}


/**
 * Renders a signed-URL photo for an anúncio. Always re-fetches a fresh signed URL
 * via TanStack Query (no persisted URLs) and falls back to a themed placeholder
 * on missing path, missing object, or expired URL (onError).
 */
export function AnuncioPhoto({
  path,
  productLabel,
  compact = false,
  imgClassName,
}: {
  path: string | null | undefined;
  productLabel?: string;
  compact?: boolean;
  imgClassName?: string;
}) {
  const { t } = useTranslation();
  const [broken, setBroken] = useState(false);
  const { data: photoUrl, refetch } = useQuery({
    // include `broken` so a refetch on error produces a new cache entry
    queryKey: ["anuncio_photo", path, broken],
    // Always mint a brand new signed URL just before render — bucket is private
    queryFn: () => getSignedUrl(path ?? null, 60 * 60),
    enabled: !!path,
    // Keep well under the 1h signed-URL expiry to avoid serving stale URLs
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 45,
    refetchOnWindowFocus: false,
  });

  if (path && photoUrl && !broken) {
    return (
      <img
        src={photoUrl}
        alt={productLabel ?? ""}
        className={cn("h-full w-full object-cover transition-transform group-hover:scale-105", imgClassName)}
        loading="lazy"
        onError={() => {
          // Try once with a fresh signed URL; if it still fails we keep the placeholder
          if (!broken) {
            setBroken(true);
            void refetch();
          }
        }}
      />
    );
  }

  return (
    <div
      aria-label={t("buy.noPhoto")}
      className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_30%_20%,color-mix(in_oklab,var(--primary)_18%,transparent),transparent_60%),linear-gradient(135deg,color-mix(in_oklab,var(--card)_92%,var(--primary)_8%),var(--card))] text-muted-foreground"
    >
      <Sprout className={compact ? "h-5 w-5 text-primary/70" : "h-8 w-8 text-primary/70"} strokeWidth={1.5} />
      {!compact && productLabel && (
        <span className="max-w-[80%] truncate text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">
          {productLabel}
        </span>
      )}
    </div>
  );
}

export function AnuncioCard({ item, units, cotacoes, sellerName, sellerTipoPerfil, hasCd = false, compact = false }: AnuncioCardProps) {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();

  const { data: seller } = useQuery({
    queryKey: ["anuncio_seller", item.vendedor_id],
    queryFn: async () =>
      (await supabase.from("profiles").select("nome_completo, tipo_perfil").eq("id", item.vendedor_id).maybeSingle()).data,
    enabled: sellerTipoPerfil === undefined || !sellerName,
    staleTime: 1000 * 60 * 5,
  });

  const isStartup =
    (sellerTipoPerfil ?? (seller as { tipo_perfil?: string | null } | null | undefined)?.tipo_perfil) === "startup_pme";


  const { data: catalogo } = useQuery({
    queryKey: ["catalogo_all_active"],
    queryFn: () => fetchCatalogoAll(false),
    staleTime: 1000 * 60 * 10,
    enabled: !!item.catalogo_item_id,
  });
  const catalogoPath = catalogo && item.catalogo_item_id
    ? catalogoPathLabel(catalogo, item.catalogo_item_id, i18n.language)
    : null;


  const { data: cambio } = useQuery({
    queryKey: ["cotacoes_cambio"],
    queryFn: async (): Promise<CambioRow[]> =>
      ((await supabase.from("cotacoes_cambio").select("moeda, valor_brl")).data ?? []) as CambioRow[],
    staleTime: 1000 * 60 * 10,
  });

  const priceUnit = units.find((u) => u.id === item.preco_unidade_id);
  const qtyUnit = units.find((u) => u.id === item.quantidade_unidade_id);

  const userMoeda = profile?.moeda_preferida ?? "BRL";
  // Deixado para compatibilidade com o restante do sistema (Mercado)
  void profile?.tipo_dolar_preferido;
  void cotacoes;

  const priceLabel = formatPrice(item.preco, item.moeda, userMoeda, cambio ?? [], i18n.language);
  const unitLabel = priceUnit ? t(`units.${priceUnit.nome_chave}`) : "";


  const harvest = item.data_colheita
    ? new Date(item.data_colheita).toLocaleDateString(
        i18n.language,
        compact ? { month: "2-digit", year: "numeric" } : { month: "short", year: "numeric" },
      )
    : null;

  const estadoLabel = compact ? toUF(item.estado) : item.estado;
  const location = [item.cidade, estadoLabel].filter(Boolean).join(" — ");
  const hasCert = item.certificacoes && item.certificacoes.length > 0;
  const isFeatured = !!item.destaque_ate && new Date(item.destaque_ate).getTime() > Date.now();

  return (
    <Link
      to="/anuncio/$id"
      params={{ id: item.id }}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/50",
        compact && "h-full",
      )}
    >
      {/* Image area — fixed 16:9 with rounded top via parent overflow */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-muted">
        <AnuncioPhoto path={item.fotos?.[0]} productLabel={item.produto} />

        {/* Badges: top-left, stacked, with breathing room. Dark text on light pill = contrast. */}
        {(item.aceita_permuta || hasCert || item.tipo_oferta === "servico" || isStartup || isFeatured || hasCd) && (
          <div className="absolute left-3 top-3 flex max-w-[70%] flex-col items-start gap-1.5">
            {hasCd && (
              <span className="inline-flex items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground shadow-sm ring-1 ring-border/60 backdrop-blur">
                {t("buy.cdBadge")}
              </span>
            )}
            {isFeatured && (
              <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm ring-1 ring-primary/40 backdrop-blur">
                <Sparkles className="h-3 w-3" /> {t("buy.featuredBadge")}
              </span>
            )}
            {isStartup && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-foreground shadow-sm ring-1 ring-border/60 backdrop-blur">
                {t("startups.badge")}
              </span>
            )}
            {item.tipo_oferta === "servico" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm backdrop-blur">
                {t("service.serviceBadge")}
              </span>
            )}
            {item.aceita_permuta && item.tipo_oferta !== "servico" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground shadow-sm ring-1 ring-border/60 backdrop-blur">
                <Repeat2 className="h-3 w-3" /> {t("buy.acceptsBarterBadge")}
              </span>
            )}
            {hasCert && item.tipo_oferta !== "servico" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm backdrop-blur">
                <BadgeCheck className="h-3 w-3" /> {t("buy.certifiedBadge")}
              </span>
            )}
          </div>
        )}

      </div>

      {/* Info block — single source of truth for title/product */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-bold text-foreground">{item.produto}</h3>
          <p className="truncate text-xs text-muted-foreground">{item.titulo}</p>
          {catalogoPath && (
            <p className="mt-0.5 truncate text-[10px] uppercase tracking-wide text-primary/80">{catalogoPath}</p>
          )}
        </div>


        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {location && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{location}</span>
            </span>
          )}
          {item.tipo_oferta !== "servico" && item.qualidade && <span>· {item.qualidade}</span>}
          {item.tipo_oferta !== "servico" && harvest && <span>· {harvest}</span>}
          {item.tipo_oferta === "servico" && item.servico_area_atuacao && (
            <span className="truncate">· {item.servico_area_atuacao}</span>
          )}
        </div>

        {item.tipo_oferta === "servico" ? (
          <div className="text-xs text-muted-foreground">
            {item.servico_modelo_cobranca && (
              <span>{t(`service.billing.${item.servico_modelo_cobranca}`)}</span>
            )}
            {item.servico_prazo && <span> · {item.servico_prazo}</span>}
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">
            {Number(item.quantidade_disponivel).toLocaleString(i18n.language)}{" "}
            {qtyUnit ? t(`units.${qtyUnit.nome_chave}`) : ""}
          </div>
        )}

        <div className="mt-auto grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3 pt-2">
          <div className="min-w-0">
            <p className="font-display text-lg font-bold leading-none text-primary">{priceLabel}</p>
            {unitLabel && (
              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">/ {unitLabel}</p>
            )}
          </div>
          {!compact && (
            <p className="max-w-[55%] truncate text-right text-[10px] text-muted-foreground">
              {t("common.by")} {sellerName ?? seller?.nome_completo ?? "—"}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
