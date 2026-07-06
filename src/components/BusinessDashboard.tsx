import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Package, Boxes, CheckCircle2, MessageCircle, Wallet, Plus, CalendarDays, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatMoney, formatMoneyCompact } from "@/lib/format";
import { PillButton } from "@/components/PillButton";


type DolarTipo = "comercial" | "turismo" | "paralelo";

interface KpiCardProps {
  label: string;
  value: string;
  icon: typeof Package;
  accent?: boolean;
  hint?: string;
  fullValue?: string;
  fullHint?: string;
  to?: string;
}

function KpiCard({ label, value, icon: Icon, accent, hint, fullValue, fullHint, to }: KpiCardProps) {
  const content = (
    <>
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
        title={fullValue}
        className={
          accent
            ? "mt-3 font-display font-bold tabular-nums text-primary [font-size:clamp(1rem,3.6vw,1.5rem)] leading-tight whitespace-nowrap"
            : "mt-3 font-display font-bold tabular-nums text-foreground [font-size:clamp(1rem,3.6vw,1.5rem)] leading-tight whitespace-nowrap"
        }
      >
        {value}
      </div>
      {hint ? (
        <div
          title={fullHint}
          className="mt-1 text-xs font-medium text-muted-foreground tabular-nums whitespace-nowrap overflow-hidden text-ellipsis"
        >
          {hint}
        </div>
      ) : null}
    </>
  );

  const className =
    "group block min-w-0 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60";

  if (to) {
    return (
      <Link to={to as never} className={className}>
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
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

      // Sum revenue in BRL (vendas.moeda is currently 'BRL' by default).
      const brlVendas = vendas.filter((v) => (v.moeda as string) === "BRL");
      const totalBRL = brlVendas.reduce((acc, v) => acc + Number(v.valor_total), 0);
      const pendingBRL = brlVendas
        .filter((v) => (v.status_pagamento as string) === "aguardando")
        .reduce((acc, v) => acc + Number(v.valor_total), 0);

      return {
        listedCount: ativos.length,
        soldCount: vendidos.length,
        volumeKg,
        negotiatingCount: conversasCount,
        revenueBRL: totalBRL,
        pendingBRL,
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
  const revenue = formatMoneyCompact(k.revenueBRL, userMoeda, userDolarPref, dolar ?? [], i18n.language);
  const revenueFull = formatMoney(k.revenueBRL, userMoeda, userDolarPref, dolar ?? [], i18n.language);
  const pendingCompact = formatMoneyCompact(
    k.pendingBRL,
    userMoeda,
    userDolarPref,
    dolar ?? [],
    i18n.language,
  );
  const pendingFull = formatMoney(
    k.pendingBRL,
    userMoeda,
    userDolarPref,
    dolar ?? [],
    i18n.language,
  );
  const pendingHint =
    k.pendingBRL > 0 ? t("dashboard.business.pendingHint", { value: pendingCompact }) : undefined;
  const pendingHintFull =
    k.pendingBRL > 0 ? t("dashboard.business.pendingHint", { value: pendingFull }) : undefined;

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">{t("dashboard.business.title")}</h2>
          <p className="text-xs text-muted-foreground">{t("dashboard.business.subtitle")}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-5">
        <KpiCard
          label={t("dashboard.business.productsListed")}
          value={nf.format(k.listedCount)}
          icon={Package}
          to="/vender"
        />
        <KpiCard
          label={t("dashboard.business.volumeListed")}
          value={formatVolume(k.volumeKg, t, i18n.language)}
          icon={Boxes}
          to="/vender"
        />
        <KpiCard
          label={t("dashboard.business.sold")}
          value={nf.format(k.soldCount)}
          icon={CheckCircle2}
          to="/financeiro"
        />
        <KpiCard
          label={t("dashboard.business.inNegotiation")}
          value={nf.format(k.negotiatingCount)}
          icon={MessageCircle}
          to="/negociacoes"
        />
        <div className="sm:col-span-2 md:col-span-4 xl:col-span-1">
          <KpiCard
            label={t("dashboard.business.revenue")}
            value={revenue}
            fullValue={revenueFull}
            icon={Wallet}
            accent
            hint={pendingHint}
            fullHint={pendingHintFull}
            to="/financeiro"
          />
        </div>
      </div>



      <UpcomingEventsMini />
    </section>
  );
}

interface UpcomingEventRow {
  id: string;
  titulo: string;
  tipo: string;
  data: string;
  hora: string | null;
  concluido: boolean;
}

function UpcomingEventsMini() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  const { data, isLoading } = useQuery({
    queryKey: ["agenda_upcoming_mini", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<UpcomingEventRow[]> => {
      const { data, error } = await supabase
        .from("agenda_eventos")
        .select("id, titulo, tipo, data, hora, concluido")
        .eq("usuario_id", user!.id)
        .is("deleted_at", null)
        .gte("data", today)
        .order("data", { ascending: true })
        .order("hora", { ascending: true, nullsFirst: true })
        .limit(3);
      if (error) throw error;
      return (data ?? []) as UpcomingEventRow[];
    },
  });

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, { day: "2-digit", month: "short" }).format(
      new Date(iso + "T00:00:00"),
    );

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-primary/15 p-1.5 text-primary">
            <CalendarDays className="h-3.5 w-3.5" />
          </span>
          <h3 className="font-display text-sm font-bold">{t("dashboard.agendaMini.title")}</h3>
        </div>
        <Link
          to="/agenda"
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          {t("dashboard.agendaMini.viewAll")}
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">{t("common.loading")}</p>
      ) : !data || data.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("dashboard.agendaMini.empty")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {data.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <div className="min-w-0">
                <p
                  className={
                    e.concluido
                      ? "truncate text-sm font-medium text-muted-foreground line-through"
                      : "truncate text-sm font-medium text-foreground"
                  }
                >
                  {e.titulo}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t(`agenda.types.${e.tipo}`)} · {fmtDate(e.data)}
                  {e.hora ? ` · ${e.hora.slice(0, 5)}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}


