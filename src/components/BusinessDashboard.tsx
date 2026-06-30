import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Package, Boxes, CheckCircle2, MessageCircle, Wallet, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatMoney } from "@/lib/format";
import { PillButton } from "@/components/PillButton";

type DolarTipo = "comercial" | "turismo" | "paralelo";

interface KpiCardProps {
  label: string;
  value: string;
  icon: typeof Package;
  accent?: boolean;
  hint?: string;
}

function KpiCard({ label, value, icon: Icon, accent, hint }: KpiCardProps) {
  return (
    <div className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span
          className={
            accent
              ? "rounded-full bg-primary/15 p-1.5 text-primary"
              : "rounded-full bg-muted p-1.5 text-muted-foreground"
          }
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div
        className={
          accent
            ? "mt-3 font-display text-2xl font-bold tabular-nums text-primary md:text-3xl"
            : "mt-3 font-display text-2xl font-bold tabular-nums text-foreground md:text-3xl"
        }
      >
        {value}
      </div>
      {hint ? (
        <div className="mt-1 text-xs font-medium text-muted-foreground tabular-nums">{hint}</div>
      ) : null}
    </div>
  );
}


function formatVolume(totalKg: number, t: (k: string) => string, locale: string) {
  if (totalKg <= 0) {
    return `0 ${t("dashboard.business.kg")}`;
  }
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

export function BusinessDashboard() {
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

      // Sum revenue in BRL (vendas.moeda is currently 'BRL' by default; treat valor_total as that currency).
      // For BRL we sum directly; for other currencies we keep numeric value and rely on formatMoney to convert.
      const totalBRL = vendas
        .filter((v) => (v.moeda as string) === "BRL")
        .reduce((acc, v) => acc + Number(v.valor_total), 0);

      return {
        listedCount: ativos.length,
        soldCount: vendidos.length,
        volumeKg,
        negotiatingCount: conversasCount,
        revenueBRL: totalBRL,
        totalListings: anuncios.length,
      };
    },
  });

  const nf = new Intl.NumberFormat(i18n.language);

  if (isLoading) {
    return (
      <section>
        <h2 className="mb-3 font-display text-lg font-bold">{t("dashboard.business.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
      </section>
    );
  }

  if (data && data.totalListings === 0) {
    return (
      <section>
        <div className="rounded-2xl border border-dashed border-border bg-card/40 p-8 text-center">
          <h2 className="font-display text-lg font-bold">{t("dashboard.business.emptyTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("dashboard.business.emptyDescription")}
          </p>
          <div className="mt-4 flex justify-center">
            <Link to="/vender/novo">
              <PillButton>
                <Plus className="h-4 w-4" />
                {t("dashboard.business.emptyCta")}
              </PillButton>
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const k = data!;
  const revenue = formatMoney(k.revenueBRL, userMoeda, userDolarPref, dolar ?? [], i18n.language);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">{t("dashboard.business.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("dashboard.business.subtitle")}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label={t("dashboard.business.productsListed")} value={nf.format(k.listedCount)} icon={Package} />
        <KpiCard
          label={t("dashboard.business.volumeListed")}
          value={formatVolume(k.volumeKg, t, i18n.language)}
          icon={Boxes}
        />
        <KpiCard label={t("dashboard.business.sold")} value={nf.format(k.soldCount)} icon={CheckCircle2} />
        <KpiCard
          label={t("dashboard.business.inNegotiation")}
          value={nf.format(k.negotiatingCount)}
          icon={MessageCircle}
        />
        <KpiCard label={t("dashboard.business.revenue")} value={revenue} icon={Wallet} accent />
      </div>
    </section>
  );
}
