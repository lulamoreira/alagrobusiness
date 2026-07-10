import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
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
  const { user, profile } = useAuth();
  const [catalogoFilter, setCatalogoFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const isStartup = profile?.tipo_perfil === "startup_pme";
  const isAdmin = profile?.tipo_perfil === "admin";
  const podePublicar = isStartup || isAdmin;

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

  const { data, isLoading } = useQuery({
    queryKey: ["startups_anuncios", page, (startupIds ?? []).join(",")],
    enabled: startupIds !== undefined,
    queryFn: async () => {
      const ids = startupIds ?? [];
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      // Belongs to Startups module: seller is startup_pme OR em_startups=true
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from("anuncios")
        .select("*", { count: "exact" })
        .eq("status", "ativo")
        .is("deleted_at", null);
      if (ids.length > 0) {
        q = q.or(`vendedor_id.in.(${ids.join(",")}),em_startups.eq.true`);
      } else {
        q = q.eq("em_startups", true);
      }
      const { data: rows, count } = await q
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(from, to);
      return { rows: (rows ?? []) as AnuncioCardData[], count: count ?? 0 };
    },
  });

  const { data: myAds } = useQuery({
    queryKey: ["startups_my_ads", user?.id],
    enabled: !!user?.id && podePublicar,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let q = (supabase as any)
        .from("anuncios")
        .select("*")
        .eq("vendedor_id", user!.id)
        .is("deleted_at", null);
      // For admins, only surface ads they published through the Startups channel.
      if (isAdmin && !isStartup) {
        q = q.eq("em_startups", true);
      }
      const { data: rows } = await q
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
      return (rows ?? []) as AnuncioCardData[];
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

  const publishBtn = (
    <Link to="/vender/novo" search={{ tipo: "", canal: "startups" }}>
      <PillButton type="button">{t("startups.publishMine")}</PillButton>
    </Link>
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold md:text-3xl">{t("startups.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("startups.subtitle")}</p>
        </div>
        {podePublicar && publishBtn}
      </div>

      {/* Meus anúncios — Startup ou Admin (admin: só os publicados pelo módulo Startups) */}
      {podePublicar && (

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold md:text-xl">{t("startups.mine.titleAll")}</h2>
            <Link to="/vender" className="text-xs text-muted-foreground hover:text-foreground underline">
              {t("startups.mine.manage")}
            </Link>
          </div>
          {(myAds?.length ?? 0) === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center">
              <p className="text-sm text-muted-foreground">{t("startups.mine.emptyInviteAll")}</p>
              <div className="mt-3 flex justify-center">{publishBtn}</div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(myAds ?? []).map((a) => (
                <div key={a.id} className="space-y-2">
                  <AnuncioCard item={a} units={unidades ?? []} cotacoes={cotacoes ?? []} />
                  <Link
                    to="/vender/editar/$id"
                    params={{ id: a.id }}
                    className="flex items-center justify-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-foreground hover:bg-accent"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    {t("common.edit")}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Descobrir */}
      <section className="space-y-4">
        <div>
          <h2 className="font-display text-lg font-semibold md:text-xl">{t("startups.discover.title")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("startups.results", { count: data?.count ?? 0 })}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card/40 p-4">
          <CatalogoCascade
            label={t("buy.filterCatalogo")}
            value={catalogoFilter}
            onChange={setCatalogoFilter}
            allowClear
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
            <p className="text-sm text-muted-foreground">
              {isStartup ? t("startups.emptyInvite") : t("startups.emptyDiscover")}
            </p>
            {isStartup && <div className="mt-4 flex justify-center">{publishBtn}</div>}
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((a) => (
                <AnuncioCard
                  key={a.id}
                  item={a}
                  units={unidades ?? []}
                  cotacoes={cotacoes ?? []}
                  sellerTipoPerfil="startup_pme"
                />
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
      </section>
    </div>
  );
}

