import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { AnuncioPhoto } from "@/components/AnuncioCard";
import { DestaqueBuyDialog } from "@/components/DestaqueBuyDialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/destaque")({ component: DestaquePage });

interface DestaquePacote {
  id: string;
  dias: number;
  preco_centavos: number;
  ordem: number;
}

interface MyAnuncioRow {
  id: string;
  titulo: string;
  produto: string;
  fotos: string[];
  destaque_ate: string | null;
  updated_at: string;
}

function DestaquePage() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [selected, setSelected] = useState<MyAnuncioRow | null>(null);

  const { data: pacotes } = useQuery({
    queryKey: ["destaque_pacotes_page"],
    queryFn: async () => {
      const { data } = await supabase
        .from("destaque_pacotes")
        .select("id, dias, preco_centavos, ordem")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      return (data ?? []) as DestaquePacote[];
    },
    staleTime: 60_000,
  });

  const { data: anuncios, isLoading } = useQuery({
    queryKey: ["my_anuncios_destaque", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("anuncios")
        .select("id, titulo, produto, fotos, destaque_ate, updated_at")
        .eq("vendedor_id", user!.id)
        .eq("status", "ativo")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });
      return (data ?? []) as MyAnuncioRow[];
    },
    enabled: !!user,
  });

  const formatPrice = (cents: number) =>
    new Intl.NumberFormat(i18n.language, { style: "currency", currency: "BRL" }).format(cents / 100);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          {t("destaquePage.badge")}
        </div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">{t("destaquePage.title")}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{t("destaquePage.intro")}</p>
      </header>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">{t("destaquePage.pricesTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("destaquePage.pricesSubtitle")}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(pacotes ?? []).map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-border bg-card p-5 transition hover:border-primary/50"
            >
              <p className="font-display text-xl font-bold">
                {t("detail.destaque.buyDays", { days: p.dias })}
              </p>
              <p className="mt-1 text-2xl font-bold text-primary">{formatPrice(p.preco_centavos)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{t("destaquePage.priceHint")}</p>
            </div>
          ))}
          {(!pacotes || pacotes.length === 0) && (
            <p className="text-sm text-muted-foreground">{t("detail.destaque.buyEmpty")}</p>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-bold">{t("destaquePage.myAdsTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("destaquePage.myAdsSubtitle")}</p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : !anuncios || anuncios.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
            <p className="text-sm text-muted-foreground">{t("destaquePage.noAds")}</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {anuncios.map((a) => {
              const isActive = a.destaque_ate && new Date(a.destaque_ate) > new Date();
              return (
                <li
                  key={a.id}
                  className="overflow-hidden rounded-2xl border border-border bg-card"
                >
                  <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center">
                    <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-xl bg-muted">
                      <AnuncioPhoto path={a.fotos?.[0]} productLabel={a.produto} compact />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-display text-base font-bold">{a.produto}</h3>
                      <p className="line-clamp-1 text-xs text-muted-foreground">{a.titulo}</p>
                      {isActive && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                          <Sparkles className="h-3 w-3" />
                          {t("detail.destaque.ate", {
                            data: new Date(a.destaque_ate!).toLocaleDateString(i18n.language),
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelected(a)}
                    className={cn(
                      "flex w-full items-center justify-center gap-2 border-t border-border px-4 py-4 text-sm font-bold transition",
                      "bg-primary text-primary-foreground hover:brightness-110",
                    )}
                  >
                    <Sparkles className="h-4 w-4" />
                    {isActive
                      ? t("destaquePage.bigButtonRenew")
                      : t("destaquePage.bigButton")}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {selected && (
        <DestaqueBuyDialog
          open={!!selected}
          anuncioId={selected.id}
          destaqueAte={selected.destaque_ate}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
