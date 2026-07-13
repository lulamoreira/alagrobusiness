import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AnuncioCard, type AnuncioCardData } from "@/components/AnuncioCard";
import { useIsMobile } from "@/hooks/use-mobile";

type DolarTipo = "comercial" | "turismo" | "paralelo";

interface Props {
  variant?: "desktop" | "mobile";
}

export function DestaquesCarousel({ variant }: Props) {
  const { t } = useTranslation();
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

  const items = anuncios ?? [];
  const visibleCount = mode === "mobile" ? 1 : 3;
  const shouldAutoScroll = items.length > visibleCount;

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const trackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIndex(0);
  }, [items.length, visibleCount]);

  useEffect(() => {
    if (!shouldAutoScroll || paused) return;
    const id = window.setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, 3000);
    return () => window.clearInterval(id);
  }, [shouldAutoScroll, paused, items.length]);

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

  if (items.length === 0) return null;

  const itemBasis =
    mode === "mobile"
      ? "basis-[85%]"
      : items.length >= 3
        ? "basis-full sm:basis-1/2 lg:basis-1/3"
        : items.length === 2
          ? "basis-full sm:basis-1/2"
          : "basis-full";

  return (
    <section
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label={t("buy.featuredTitle")}
    >
      <h2 className="mb-3 font-display text-lg font-bold">{t("buy.featuredTitle")}</h2>
      <div
        ref={trackRef}
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <div key={item.id} className={`${itemBasis} shrink-0 snap-start min-w-0`}>
            <AnuncioCard item={item} units={unitsTyped} cotacoes={cotacoesTyped} />
          </div>
        ))}
      </div>
    </section>
  );
}
