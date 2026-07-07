import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, CheckCircle2, Sparkles } from "lucide-react";
import { PublicShell } from "@/components/PublicShell";
import { PillButton } from "@/components/PillButton";

const PERFIS = ["produtor", "marca", "lojista"] as const;
type Perfil = (typeof PERFIS)[number];

// perfil (slug público) → tipo_perfil (enum do banco)
const TIPO_MAP: Record<Perfil, string> = {
  produtor: "vendedor",
  marca: "marca",
  lojista: "lojista",
};

export const Route = createFileRoute("/para/$perfil")({
  ssr: false,
  beforeLoad: ({ params }) => {
    if (!PERFIS.includes(params.perfil as Perfil)) throw notFound();
  },
  component: SegmentPage,
});

function SegmentPage() {
  const { perfil } = Route.useParams();
  const p = perfil as Perfil;
  const { t } = useTranslation();
  const k = (s: string) => t(`segment.${p}.${s}`);
  const tipo = TIPO_MAP[p];

  const benefits = [0, 1, 2, 3] as const;
  const steps = [0, 1, 2] as const;

  return (
    <PublicShell>
      {/* Hero */}
      <section className="mx-auto max-w-5xl px-4 pb-12 pt-14 sm:px-6 md:pt-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {k("eyebrow")}
          </span>
          <h1 className="mt-6 font-display text-4xl font-bold leading-tight tracking-tight text-foreground md:text-5xl">
            {k("title")}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            {k("subtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link to="/cadastro" search={{ perfil: tipo }}>
              <PillButton variant="primary" className="px-8 py-4 text-base">
                {k("cta")}
                <ArrowRight className="h-4 w-4" />
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

      {/* Benefits */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-foreground md:text-4xl">{k("benefitsTitle")}</h2>
          <p className="mt-3 text-muted-foreground">{k("benefitsSubtitle")}</p>
        </div>
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {benefits.map((i) => {
            const title = k(`b${i + 1}.title`);
            if (!title || title.startsWith("segment.")) return null;
            return (
              <div
                key={i}
                className="rounded-2xl border border-border bg-card/60 p-6 backdrop-blur transition hover:border-primary/50"
              >
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <CheckCircle2 className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{k(`b${i + 1}.desc`)}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold text-foreground md:text-4xl">{k("howTitle")}</h2>
        </div>
        <ol className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {steps.map((i) => (
            <li key={i} className="relative rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
              <span className="absolute -top-3 left-6 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                {i + 1}
              </span>
              <h3 className="mt-3 font-display text-base font-semibold text-foreground">
                {k(`s${i + 1}.title`)}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">{k(`s${i + 1}.desc`)}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/20 via-card/70 to-card/60 p-8 text-center backdrop-blur md:p-14">
          <h2 className="font-display text-3xl font-bold text-foreground md:text-4xl">{k("finalTitle")}</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">{k("finalSubtitle")}</p>
          <div className="mt-8">
            <Link to="/cadastro" search={{ perfil: tipo }}>
              <PillButton variant="primary" className="px-8 py-4 text-base">
                {k("cta")}
              </PillButton>
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
