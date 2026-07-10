import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AnuncioCard, type AnuncioCardData } from "@/components/AnuncioCard";
import { CatalogoCascade } from "@/components/CatalogoCascade";
import { fetchCatalogoAll, catalogoSubtreeIds } from "@/lib/catalogo";
import { PillButton } from "@/components/PillButton";

export const Route = createFileRoute("/_authenticated/startups")({
  component: StartupsPage,
});

const PAGE_SIZE = 12;

function StartupsPage() {
  const { t } = useTranslation();
  const [catalogoFilter, setCatalogoFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  // Startup/PME seller ids
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

  const orFilter = useMemo(() => {
    const ids = startupIds ?? [];
    if (ids.length === 0) return `tipo_oferta.eq.servico`;
    return `tipo_oferta.eq.servico,vendedor_id.in.(${ids.join(",")})`;
  }, [startupIds]);

  const { data, isLoading } = useQuery({
    queryKey: ["startups_anuncios", page, orFilter],
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const q = (supabase as any)
        .from("anuncios")
        .select("*", { count: "exact" })
        .eq("status", "ativo")
        .is("deleted_at", null)
        .or(orFilter)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);
      const { data: rows, count } = await q;
      return { rows: (rows ?? []) as AnuncioCardData[], count: count ?? 0 };
    },
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

  const { data: cotacoes } = useQuery({
    queryKey: ["cotacoes_dolar"],
    queryFn: async () => (await supabase.from("cotacoes_dolar").select("tipo, valor_brl")).data ?? [],
    staleTime: 1000 * 60 * 30,
  });

  const filtered = useMemo(() => {
    const rows = data?.rows ?? [];
    if (!catalogoFilter || !catalogoNodes) return rows;
    const allowed = new Set(catalogoSubtreeIds(catalogoNodes, catalogoFilter));
    return rows.filter((a) => {
      const cid = (a as unknown as { catalogo_item_id?: string | null }).catalogo_item_id;
      return cid ? allowed.has(cid) : false;
    });
  }, [data, catalogoFilter, catalogoNodes]);

  const totalPages = Math.max(1, Math.ceil((data?.count ?? 0) / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">{t("startups.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("startups.subtitle")}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("startups.results", { count: data?.count ?? 0 })}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card/40 p-4">
        <CatalogoCascade
          label={t("buy.filterCatalogo")}
          value={catalogoFilter}
          onChange={setCatalogoFilter}
          tipoFilter="servico"
          allowClear
        />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">{t("startups.empty")}</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((a) => (
              <AnuncioCard key={a.id} item={a} units={unidades ?? []} cotacoes={cotacoes ?? []} />
            ))}
          </div>

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              {t("startups.showingPage", { page: page + 1, pages: totalPages })}
            </p>
            <div className="flex gap-2">
              <PillButton
                type="button"
                variant="secondary"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                {t("startups.prev")}
              </PillButton>
              <PillButton
                type="button"
                variant="secondary"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                {t("startups.next")}
              </PillButton>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
