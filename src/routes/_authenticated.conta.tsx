import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Sparkles, Clock, Settings, Loader2, CalendarCheck, CalendarClock, ArrowRight, Lock, MapPin, Save, Warehouse } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { usePlan } from "@/lib/plan";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { geocodeCep } from "@/lib/geocode";
import { DarkInput } from "@/components/DarkInput";
import { CdSelfRegisterDialog } from "@/components/CdSelfRegisterDialog";
import { useMyCdsCount } from "@/hooks/useMyCdsCount";
import { listCountries } from "@/lib/countries";

export const Route = createFileRoute("/_authenticated/conta")({
  component: ContaPage,
});

function openTopLevel(url: string) {
  try {
    if (window.top && window.top !== window.self) {
      window.top.location.href = url;
      return;
    }
    window.location.href = url;
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function ContaPage() {
  const { t, i18n } = useTranslation();
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const {
    codigo,
    limites,
    isPro,
    isProAtivo,
    emTrial,
    diasRestantesTrial,
    trialAte,
    inicio,
    fim,
    loading,
  } = usePlan();

  const myCdsCount = useMyCdsCount();
  const [cdDialogOpen, setCdDialogOpen] = useState(false);

  const [locCep, setLocCep] = useState("");
  const [locCidade, setLocCidade] = useState("");
  const [locEstado, setLocEstado] = useState("");
  const [locLat, setLocLat] = useState<number | null>(null);
  const [locLng, setLocLng] = useState<number | null>(null);
  const [locInfo, setLocInfo] = useState<string | null>(null);
  const [locSaving, setLocSaving] = useState(false);
  const [locGeocoding, setLocGeocoding] = useState(false);
  const [pais, setPais] = useState<string>("");
  const [paisSaving, setPaisSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setLocCep((p) => p || profile.cep || "");
    setLocCidade((p) => p || profile.cidade || "");
    setLocEstado((p) => p || profile.estado || "");
    setLocLat((p) => (p != null ? p : profile.latitude ?? null));
    setLocLng((p) => (p != null ? p : profile.longitude ?? null));
    setPais((p) => p || (profile as unknown as { pais?: string | null }).pais || "");
  }, [profile]);

  const savePais = async () => {
    if (!user) return;
    setPaisSaving(true);
    const { error } = await supabase
      .from("profiles")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .update({ pais: pais || null } as any)
      .eq("id", user.id);
    setPaisSaving(false);
    if (error) {
      toast.error(t("international.myCountrySaveError"));
      return;
    }
    toast.success(t("international.myCountrySaved"));
    await refreshProfile();
  };

  const handleLocCepBlur = async () => {
    const digits = (locCep || "").replace(/\D+/g, "");
    if (digits.length !== 8) return;
    setLocGeocoding(true);
    const geo = await geocodeCep(digits);
    setLocGeocoding(false);
    if (!geo) {
      setLocInfo(t("geo.notFound"));
      return;
    }
    if (geo.cidade) setLocCidade(geo.cidade);
    if (geo.estado) setLocEstado(geo.estado);
    setLocLat(geo.latitude);
    setLocLng(geo.longitude);
    if (geo.latitude != null && geo.longitude != null) {
      setLocInfo(t("geo.detected", { cidade: geo.cidade ?? "—", estado: geo.estado ?? "—" }));
    } else {
      setLocInfo(t("geo.noCoords"));
    }
  };

  const saveLocation = async () => {
    if (!user) return;
    setLocSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        cep: locCep.trim() || null,
        cidade: locCidade.trim() || null,
        estado: locEstado.trim() || null,
        latitude: locLat,
        longitude: locLng,
      })
      .eq("id", user.id);
    setLocSaving(false);
    if (error) {
      toast.error(t("geo.saveError"));
      return;
    }
    toast.success(t("geo.saved"));
    await refreshProfile();
    qc.invalidateQueries();
  };

  const [loadingPortal, setLoadingPortal] = useState(false);

  const { data: assinatura } = useQuery({
    queryKey: ["assinatura_conta", user?.id],
    enabled: !!user,
    staleTime: 1000 * 30,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assinaturas")
        .select("origem, status, stripe_customer_id, fim")
        .eq("usuario_id", user!.id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as {
        origem: string | null;
        status: string | null;
        stripe_customer_id: string | null;
        fim: string | null;
      } | null;
    },
  });

  const canManageStripe =
    !!assinatura?.stripe_customer_id &&
    assinatura?.origem === "stripe" &&
    assinatura?.status === "ativa";

  const dateFmt = new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium" });
  const fmt = (iso: string | null) => (iso ? dateFmt.format(new Date(iso)) : null);

  const memberSinceLabel = (() => {
    if (!inicio) return null;
    const start = new Date(inicio);
    const now = new Date();
    const months = Math.max(
      0,
      (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth()),
    );
    if (months < 1) {
      const days = Math.max(1, Math.round((now.getTime() - start.getTime()) / 86400000));
      return t("account.days", { n: days });
    }
    if (months < 12) return t("account.months", { n: months });
    const years = Math.floor(months / 12);
    return t("account.years", { n: years });
  })();

  const statusKey = emTrial
    ? "account.statusTrial"
    : isProAtivo
      ? "account.statusActive"
      : codigo === "free"
        ? "account.statusFree"
        : "account.statusExpired";

  const planName = codigo === "pro" ? "Pro" : t("account.planFree");

  const hasClube = limites?.clube === true || isPro;

  async function handleGerenciar() {
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: {},
      });
      if (error) throw error;
      const payload = data as { url?: string; error?: string };
      if (payload?.error === "no_stripe_customer") {
        toast.error(t("plan.portalNoCustomer"));
        setLoadingPortal(false);
        return;
      }
      if (!payload?.url) throw new Error("no_url");
      toast.info(t("plan.portalOpening"));
      openTopLevel(payload.url);
    } catch (e) {
      console.error(e);
      toast.error(t("plan.portalError"));
      setLoadingPortal(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="text-center">
        <h1 className="font-display text-3xl font-bold md:text-4xl">{t("account.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("account.subtitle")}</p>
      </header>

      {/* Current plan card */}
      <section className="rounded-3xl border border-border bg-card p-6 shadow-xl md:p-8">
        <div className="flex flex-wrap items-center gap-3">
          {isPro ? (
            <Crown className="h-6 w-6 text-primary" />
          ) : (
            <Sparkles className="h-6 w-6 text-muted-foreground" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("account.currentPlan")}
            </p>
            <h2 className="font-display text-2xl font-bold">{planName}</h2>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider",
              emTrial
                ? "border-primary/40 bg-primary/10 text-primary"
                : isProAtivo
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : codigo === "free"
                    ? "border-border bg-background/60 text-muted-foreground"
                    : "border-destructive/40 bg-destructive/10 text-destructive",
            )}
          >
            {emTrial && <Clock className="h-3 w-3" />}
            {isProAtivo && !emTrial && <Crown className="h-3 w-3" />}
            {t(statusKey)}
          </span>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {/* Member since */}
          {inicio && codigo !== "free" ? (
            <div className="rounded-2xl border border-border bg-background/40 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <CalendarCheck className="h-4 w-4" />
                {t("account.memberSince", { date: fmt(inicio) })}
              </div>
              {memberSinceLabel && (
                <p className="mt-1 text-sm text-foreground">
                  {t("account.memberSinceRelative", { value: memberSinceLabel })}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-background/40 p-4">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Sparkles className="h-4 w-4" />
                {t("account.planFree")}
              </div>
            </div>
          )}

          {/* Renewal / validity */}
          <div className="rounded-2xl border border-border bg-background/40 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <CalendarClock className="h-4 w-4" />
              {emTrial ? t("account.validity") : t("account.renewal")}
            </div>
            {emTrial && trialAte ? (
              <p className="mt-1 text-sm text-foreground">
                {t("account.trialUntil", { date: fmt(trialAte) })} ·{" "}
                <span className="text-primary">{t("account.daysLeft", { n: diasRestantesTrial })}</span>
              </p>
            ) : isProAtivo && fim ? (
              <p className="mt-1 text-sm text-foreground">
                {t("account.expiresOn", { date: fmt(fim) })}
              </p>
            ) : isProAtivo ? (
              <p className="mt-1 text-sm text-foreground">{t("account.autoRenew")}</p>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">—</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {canManageStripe ? (
            <button
              onClick={handleGerenciar}
              disabled={loadingPortal}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
            >
              {loadingPortal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
              {t("account.manage")}
            </button>
          ) : (
            <Link
              to="/planos"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110"
            >
              <Crown className="h-4 w-4" />
              {t("account.upgrade")}
            </Link>
          )}
        </div>
        {canManageStripe && (
          <p className="mt-2 text-[11px] text-muted-foreground">{t("account.manageDesc")}</p>
        )}
      </section>

      {/* Clube card */}
      <section
        className={cn(
          "rounded-3xl border p-6 shadow-lg md:p-7",
          hasClube ? "border-primary/40 bg-primary/5" : "border-border bg-card/60",
        )}
      >
        <div className="flex items-start gap-4">
          <div
            className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border",
              hasClube ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-background text-muted-foreground",
            )}
          >
            {hasClube ? <Sparkles className="h-6 w-6" /> : <Lock className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-bold">{t("account.clubCardTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {hasClube ? t("account.clubCardActive") : t("account.clubCardLocked")}
            </p>
            <div className="mt-4">
              {hasClube ? (
                <Link
                  to="/clube"
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-bold text-primary-foreground transition hover:brightness-110"
                >
                  {t("account.clubOpen")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <Link
                  to="/planos"
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-bold text-primary-foreground transition hover:brightness-110"
                >
                  {t("account.upgrade")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* My location */}
      {/* Become a Distribution Center */}
      <section className="rounded-3xl border border-border bg-card p-6 shadow-lg md:p-7">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-primary">
            <Warehouse className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-bold">{t("cdSelf.contaTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("cdSelf.contaDesc")}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCdDialogOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-bold text-primary-foreground transition hover:brightness-110"
              >
                <Warehouse className="h-3.5 w-3.5" />
                {t("cdSelf.ctaBtn")}
              </button>
              {myCdsCount > 0 && (
                <Link
                  to="/meus-cds"
                  className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-5 py-2 text-xs font-bold text-foreground transition hover:bg-background"
                >
                  {t("cdSelf.gotoMine")}
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <CdSelfRegisterDialog open={cdDialogOpen} onOpenChange={setCdDialogOpen} />

      {/* My location */}
      {/* My country (for international buyers/exporters) */}
      <section className="rounded-3xl border border-border bg-card p-6 shadow-lg md:p-7">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-background/60 text-primary">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-bold">{t("international.myCountryTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("international.myCountryDesc")}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={pais}
            onChange={(e) => setPais(e.target.value)}
            className="min-w-[200px] flex-1 rounded-xl border border-border bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="">{t("international.myCountryPlaceholder")}</option>
            {listCountries(i18n.language).map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={savePais}
            disabled={paisSaving}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
          >
            {paisSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t("common.save")}
          </button>
        </div>
      </section>

      <section id="minha-localizacao" className="rounded-3xl border border-border bg-card p-6 shadow-lg md:p-7">

        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border bg-background/60 text-primary">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-bold">{t("geo.myLocationTitle")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t("geo.myLocationDesc")}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <DarkInput
            label={t("onboarding.cep")}
            value={locCep}
            onChange={(e) => setLocCep(e.target.value)}
            onBlur={handleLocCepBlur}
            placeholder="00000-000"
          />
          <DarkInput
            label={t("signup.city")}
            value={locCidade}
            onChange={(e) => setLocCidade(e.target.value)}
          />
          <DarkInput
            label={t("signup.state")}
            value={locEstado}
            onChange={(e) => setLocEstado(e.target.value)}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {locGeocoding
              ? t("geo.detecting")
              : locLat != null && locLng != null
                ? t("geo.hasCoords")
                : locInfo ?? t("geo.autoFromCep")}
          </p>
          <button
            type="button"
            onClick={saveLocation}
            disabled={locSaving}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-xs font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
          >
            {locSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            {t("common.save")}
          </button>
        </div>
      </section>
    </div>
  );
}
