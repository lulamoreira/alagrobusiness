import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  ShoppingCart,
  Store,
  Building2,
  Sparkles,
  TrendingUp,
  Newspaper,
  GraduationCap,
  Crown,
  MessagesSquare,
  UserPlus,
  LayoutDashboard,
  ArrowRight,
} from "lucide-react";
import { AmbientGlow } from "@/components/AmbientGlow";
import { Logo } from "@/components/Logo";
import { PillButton } from "@/components/PillButton";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "AGROBUSINESS — Marketplace do Agronegócio" },
      {
        name: "description",
        content:
          "Do campo ao mercado: anuncie, negocie e acompanhe cotações, clima, notícias e cursos. A plataforma do agronegócio brasileiro para produtores, compradores, lojistas e marcas.",
      },
      { property: "og:title", content: "AGROBUSINESS — Marketplace do Agronegócio" },
      {
        property: "og:description",
        content: "A plataforma do agronegócio brasileiro para produtores, compradores, lojistas e marcas.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PublicHome,
});

function PublicHome() {
  const { t } = useTranslation();
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user && profile) {
      if (!profile.perfil_completo) navigate({ to: "/completar-cadastro" });
      else if (profile.status === "ativo") navigate({ to: "/painel" });
      else if (profile.status === "bloqueado") navigate({ to: "/bloqueado" });
      else if (profile.status === "aguardando_aprovacao") navigate({ to: "/aguardando-aprovacao" });
    }
  }, [user, profile, loading, navigate]);

  const audiences = [
    { icon: Sparkles, key: "producer", to: "/para/$perfil" as const, params: { perfil: "produtor" }, search: undefined },
    { icon: ShoppingCart, key: "buyer", to: "/cadastro" as const, params: undefined, search: { perfil: "comprador" } },
    { icon: Store, key: "shop", to: "/para/$perfil" as const, params: { perfil: "lojista" }, search: undefined },
    { icon: Building2, key: "brand", to: "/para/$perfil" as const, params: { perfil: "marca" }, search: undefined },
  ] as const;

  const features = [
    { icon: Store, key: "marketplace" },
    { icon: TrendingUp, key: "quotes" },
    { icon: Newspaper, key: "news" },
    { icon: GraduationCap, key: "learning" },
    { icon: Crown, key: "club" },
  ] as const;

  const steps = [
    { icon: UserPlus, key: "step1" },
    { icon: Store, key: "step2" },
    { icon: MessagesSquare, key: "step3" },
    { icon: LayoutDashboard, key: "step4" },
  ] as const;

  return (
    <div className="relative min-h-screen">
      <AmbientGlow />

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border/40 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Logo size="sm" to="/" />
          <nav className="ml-6 hidden items-center gap-5 text-sm text-muted-foreground md:flex">
            <a href="#how" className="hover:text-foreground">{t("public.nav.howItWorks")}</a>
            <Link to="/contato" className="hover:text-foreground">{t("public.nav.contact")}</Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSelector />
            <Link to="/login">
              <PillButton variant="secondary" className="px-4 py-2 text-xs sm:px-6 sm:py-3 sm:text-sm">{t("public.nav.signin")}</PillButton>
            </Link>
            <Link to="/cadastro">
              <PillButton variant="primary" className="px-4 py-2 text-xs sm:px-6 sm:py-3 sm:text-sm">{t("public.nav.signup")}</PillButton>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 md:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t("public.hero.eyebrow")}
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold leading-tight tracking-tight text-foreground md:text-6xl">
            {t("public.hero.title")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            {t("public.hero.subtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/cadastro">
              <PillButton variant="primary" className="px-8 py-4 text-base">
                {t("public.hero.ctaPrimary")}
                <ArrowRight className="h-4 w-4" />
              </PillButton>
            </Link>
            <a href="#how">
              <PillButton variant="secondary" className="px-8 py-4 text-base">
                {t("public.hero.ctaSecondary")}
              </PillButton>
            </a>
          </div>
        </div>
      </section>

      {/* Audience */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        <SectionHeader title={t("public.audience.title")} subtitle={t("public.audience.subtitle")} />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {audiences.map(({ icon: Icon, key, to, params, search }) => (
            <div
              key={key}
              className="group flex flex-col rounded-2xl border border-border bg-card/60 p-6 backdrop-blur transition hover:border-primary/50 hover:bg-card"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                {t(`public.audience.${key}.title`)}
              </h3>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">
                {t(`public.audience.${key}.desc`)}
              </p>
              {to === "/para/$perfil" ? (
                <Link
                  to="/para/$perfil"
                  params={params!}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary"
                >
                  {t("public.audience.cta")} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              ) : (
                <Link
                  to="/cadastro"
                  search={search!}
                  className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary"
                >
                  {t("public.audience.cta")} <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        <SectionHeader title={t("public.features.title")} subtitle={t("public.features.subtitle")} />
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, key }) => (
            <div
              key={key}
              className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur transition hover:border-primary/50"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-display text-lg font-semibold text-foreground">
                {t(`public.features.${key}.title`)}
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                {t(`public.features.${key}.desc`)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        <SectionHeader title={t("public.how.title")} subtitle={t("public.how.subtitle")} />
        <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, key }, idx) => (
            <li
              key={key}
              className="relative rounded-2xl border border-border bg-card/60 p-6 backdrop-blur"
            >
              <span className="absolute -top-3 left-6 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {idx + 1}
              </span>
              <Icon className="h-6 w-6 text-primary" />
              <h3 className="mt-3 font-display text-base font-semibold text-foreground">
                {t(`public.how.${key}.title`)}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(`public.how.${key}.desc`)}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/20 via-card/70 to-card/60 p-8 text-center backdrop-blur md:p-14">
          <h2 className="font-display text-3xl font-bold text-foreground md:text-4xl">
            {t("public.finalCta.title")}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            {t("public.finalCta.subtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/cadastro">
              <PillButton variant="primary" className="px-8 py-4 text-base">
                {t("public.finalCta.primary")}
              </PillButton>
            </Link>
            <Link to="/contato">
              <PillButton variant="secondary" className="px-8 py-4 text-base">
                {t("public.finalCta.secondary")}
              </PillButton>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-background/50">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Logo size="sm" />
            <p className="mt-3 text-sm text-muted-foreground">{t("public.footer.tagline")}</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <Link to="/sobre" className="hover:text-foreground">{t("public.footer.about")}</Link>
            <Link to="/contato" className="hover:text-foreground">{t("public.footer.contact")}</Link>
            <Link to="/termos" className="hover:text-foreground">{t("public.footer.terms")}</Link>
            <Link to="/privacidade" className="hover:text-foreground">{t("public.footer.privacy")}</Link>
          </nav>
        </div>
        <div className="border-t border-border/40 px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
          © {new Date().getFullYear()} AGROBUSINESS. {t("public.footer.rights")}
        </div>
      </footer>
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="font-display text-3xl font-bold text-foreground md:text-4xl">{title}</h2>
      <p className="mt-3 text-muted-foreground">{subtitle}</p>
    </div>
  );
}
