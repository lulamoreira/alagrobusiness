import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Sparkles, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AnuncioCard, type AnuncioCardData } from "@/components/AnuncioCard";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/lib/auth";

type DolarTipo = "comercial" | "turismo" | "paralelo";

interface Props {
  variant?: "desktop" | "mobile";
}

export function DestaquesCarousel({ variant }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const mode = variant ?? (isMobile ? "mobile" : "desktop");

  const { data: anuncios } = useQuery({
    queryKey: ["destaques_carousel"],
    queryFn: async (): Promise<AnuncioCardData[]> => {
      const nowIso = new Date().toISOString();
      const { data } = await supabase
        .from("anuncios")
        .select("*")
        .eq("status", "ativo")
        .is("deleted_at", null)
        .gt("destaque_ate", nowIso)
        .order("destaque_ate", { ascending: false })
        .limit(12);
      return (data ?? []) as unknown as AnuncioCardData[];
    },
    staleTime: 1000 * 60 * 2,
  });

  const { data: unidades } = useQuery({
    queryKey: ["unidades_all"],
    queryFn: async () =>
      (await supabase.from("unidades").select("*").is("deleted_at", null)).data ?? [],
    staleTime: 1000 * 60 * 30,
  });

  const { data: cotacoes } = useQuery({
    queryKey: ["cotacoes_dolar"],
    queryFn: async () =>
      (await supabase.from("cotacoes_dolar").select("tipo, valor_brl")).data ?? [],
    staleTime: 1000 * 60 * 30,
  });

  const { data: prefs } = useQuery({
    queryKey: ["preferencias_destaque_scroll", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("preferencias")
        .select("destaque_scroll_segundos")
        .eq("usuario_id", user!.id)
        .maybeSingle();
      return data;
    },
    staleTime: 1000 * 60,
  });

  const intervalMs = Math.max(2, Math.min(15, prefs?.destaque_scroll_segundos ?? 3)) * 1000;

  const items = anuncios ?? [];
  const showCta = items.length < 3;
  const totalSlides = items.length + (showCta ? 1 : 0);
  const visibleCount = mode === "mobile" ? 1 : mode === "desktop" ? 3 : 2;
  const shouldAutoScroll = totalSlides > visibleCount;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIndex(0);
  }, [totalSlides, visibleCount]);

  useEffect(() => {
    if (!shouldAutoScroll || paused || totalSlides === 0) return;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % totalSlides);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [shouldAutoScroll, paused, totalSlides, intervalMs]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const child = el.children[index] as HTMLElement | undefined;
    if (child) {
      el.scrollTo({ left: child.offsetLeft - el.offsetLeft, behavior: "smooth" });
    }
  }, [index]);

  const cotacoesTyped = useMemo(
    () =>
      (cotacoes ?? []).map((r) => ({
        tipo: r.tipo as DolarTipo,
        valor_brl: Number(r.valor_brl),
      })),
    [cotacoes],
  );

  const unitsTyped = useMemo(
    () =>
      (unidades ?? []).map((u) => ({ id: u.id as string, nome_chave: u.nome_chave as string })),
    [unidades],
  );

  if (totalSlides === 0) return null;

  // Fixed responsive breakpoints: 1 mobile / 2 tablet / 3 desktop — independent of item count.
  const itemBasis = "basis-full md:basis-1/2 lg:basis-1/3";

  return (
    <section
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label={t("buy.featuredTitle")}
    >
      <h2 className="mb-3 font-display text-lg font-bold">{t("buy.featuredTitle")}</h2>
      <div
        ref={trackRef}
        className="-mx-1 flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto px-1 pb-1 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <div key={item.id} className={`${itemBasis} h-auto shrink-0 snap-start min-w-0`}>
            <AnuncioCard item={item} units={unitsTyped} cotacoes={cotacoesTyped} compact />
          </div>
        ))}
        {showCta && (
          <div className={`${itemBasis} shrink-0 snap-start min-w-0`}>
            <Link
              to="/destaque"
              className="group relative flex h-full min-h-[220px] flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border-2 border-dashed border-primary/50 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 text-center transition hover:border-primary hover:from-primary/20"
            >
              <div className="rounded-full bg-primary/15 p-3">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <p className="font-display text-base font-bold text-foreground">
                {t("destaquePage.ctaCardTitle")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("destaquePage.ctaCardSubtitle")}
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition group-hover:brightness-110">
                {t("destaquePage.ctaCardAction")}
                <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
