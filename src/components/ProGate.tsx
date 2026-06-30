import { Link } from "@tanstack/react-router";
import { Lock, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePlan } from "@/lib/plan";
import type { ReactNode } from "react";

interface ProGateProps {
  /** Limite key in plan.limites that must be true; defaults to painel_completo */
  requires?: keyof import("@/lib/plan").PlanLimites;
  featureKey?: string;
  children: ReactNode;
}

export function ProGate({ requires = "painel_completo", featureKey, children }: ProGateProps) {
  const { t } = useTranslation();
  const { limites, loading } = usePlan();

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-pulse rounded-full bg-primary/40" />
      </div>
    );
  }

  if (limites?.[requires] === true) {
    return <>{children}</>;
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center justify-center rounded-3xl border border-border bg-card/60 p-8 text-center shadow-xl backdrop-blur md:p-12">
      <div className="relative mb-5">
        <div className="absolute inset-0 -z-10 rounded-full bg-primary/20 blur-2xl" />
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
          <Lock className="h-7 w-7 text-primary" />
        </div>
      </div>
      <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary">
        <Sparkles className="h-3 w-3" /> {t("plan.proBadge")}
      </span>
      <h2 className="font-display text-2xl font-bold md:text-3xl">
        {featureKey ? t(featureKey) : t("plan.gate.title")}
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {t("plan.gate.description")}
      </p>
      <Link
        to="/planos"
        className="mt-6 inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
      >
        {t("plan.viewPlans")}
      </Link>
    </div>
  );
}
