import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Repeat2, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getSignedUrl } from "@/lib/storage";
import { formatMoney } from "@/lib/format";
import { useAuth } from "@/lib/auth";

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
}

interface AnuncioCardProps {
  item: AnuncioCardData;
  units: { id: string; nome_chave: string }[];
  cotacoes: { tipo: "comercial" | "turismo" | "paralelo"; valor_brl: number }[];
  sellerName?: string;
}

export function AnuncioCard({ item, units, cotacoes, sellerName }: AnuncioCardProps) {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();

  const { data: photoUrl } = useQuery({
    queryKey: ["anuncio_photo", item.id, item.fotos?.[0]],
    queryFn: () => getSignedUrl(item.fotos?.[0] ?? null),
    enabled: !!item.fotos?.[0],
    staleTime: 1000 * 60 * 30,
  });

  const { data: seller } = useQuery({
    queryKey: ["anuncio_seller", item.vendedor_id],
    queryFn: async () =>
      (await supabase.from("profiles").select("nome_completo").eq("id", item.vendedor_id).maybeSingle()).data,
    enabled: !sellerName,
    staleTime: 1000 * 60 * 5,
  });

  const priceUnit = units.find((u) => u.id === item.preco_unidade_id);
  const qtyUnit = units.find((u) => u.id === item.quantidade_unidade_id);

  const userMoeda = profile?.moeda_preferida ?? "BRL";
  const userDolar = profile?.tipo_dolar_preferido ?? "comercial";

  const priceLabel = formatMoney(item.preco, userMoeda, userDolar, cotacoes, i18n.language);
  const unitLabel = priceUnit ? t(`units.${priceUnit.nome_chave}`) : "";

  const harvest = item.data_colheita
    ? new Date(item.data_colheita).toLocaleDateString(i18n.language, { month: "short", year: "numeric" })
    : null;

  return (
    <Link
      to="/anuncio/$id"
      params={{ id: item.id }}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/50"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={item.titulo}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
            {t("form.photos")}
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-wrap gap-1">
          {item.aceita_permuta && (
            <span className="flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-semibold text-foreground backdrop-blur">
              <Repeat2 className="h-3 w-3" /> {t("buy.acceptsBarterBadge")}
            </span>
          )}
          {item.certificacoes && item.certificacoes.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-primary/90 px-2 py-0.5 text-[10px] font-semibold text-primary-foreground backdrop-blur">
              <BadgeCheck className="h-3 w-3" /> {t("buy.certifiedBadge")}
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display text-base font-bold text-foreground line-clamp-1">{item.produto}</h3>
            <p className="line-clamp-1 text-xs text-muted-foreground">{item.titulo}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {(item.cidade || item.estado) && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {[item.cidade, item.estado].filter(Boolean).join(" — ")}
            </span>
          )}
          {item.qualidade && <span>· {item.qualidade}</span>}
          {harvest && <span>· {harvest}</span>}
        </div>
        <div className="text-xs text-muted-foreground">
          {Number(item.quantidade_disponivel).toLocaleString(i18n.language)} {qtyUnit ? t(`units.${qtyUnit.nome_chave}`) : ""}
        </div>
        <div className="mt-auto flex items-end justify-between pt-2">
          <div>
            <p className="font-display text-lg font-bold text-primary">{priceLabel}</p>
            {unitLabel && <p className="text-[10px] uppercase text-muted-foreground">/ {unitLabel}</p>}
          </div>
          <p className="text-[10px] text-muted-foreground line-clamp-1">
            {t("common.by")} {sellerName ?? seller?.nome_completo ?? "—"}
          </p>
        </div>
      </div>
    </Link>
  );
}
