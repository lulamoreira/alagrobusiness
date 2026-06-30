import { Link } from "@tanstack/react-router";
import { Sparkles, Clock, Crown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePlan } from "@/lib/plan";
import { toast } from "sonner";
import { isPaywallError } from "@/lib/plan";

export function PlanBanner() {
  const { t } = useTranslation();
  const { emTrial, isProAtivo, codigo, diasRestantesTrial, loading } = usePlan();

  if (loading) return null;

  if (emTrial) {
    return (
      <Link
        to="/planos"
        className="mx-auto mb-4 flex max-w-7xl items-center justify-between gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-4 py-2.5 text-sm shadow-sm transition hover:bg-primary/15"
      >
        <div className="flex items-center gap-2 text-foreground">
          <Clock className="h-4 w-4 text-primary" />
          <span>
            {t("plan.banner.trial", { days: diasRestantesTrial })}
          </span>
        </div>
        <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-bold text-primary-foreground">
          {t("plan.banner.cta")}
        </span>
      </Link>
    );
  }

  if (!isProAtivo && codigo === "free") {
    return (
      <Link
        to="/planos"
        className="mx-auto mb-4 flex max-w-7xl items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 px-4 py-2 text-xs shadow-sm transition hover:bg-card"
      >
        <span className="text-muted-foreground">{t("plan.banner.free")}</span>
        <span className="font-semibold text-primary">{t("plan.banner.upgradeLink")}</span>
      </Link>
    );
  }

  return null;
}

export function PlanBadge() {
  const { t } = useTranslation();
  const { isPro, emTrial, isProAtivo } = usePlan();
  if (!isPro) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
      {isProAtivo ? <Crown className="h-3 w-3" /> : <Sparkles className="h-3 w-3" />}
      {emTrial ? t("plan.trialBadge") : t("plan.proBadge")}
    </span>
  );
}

/** Helper: show friendly paywall toast if error is P0001 from backend triggers. */
export function handlePaywallError(err: unknown, t: (k: string) => string): boolean {
  const kind = isPaywallError(err);
  if (!kind) return false;
  toast.error(t(kind === "anuncios" ? "plan.limit.anuncios" : "plan.limit.alertas"), {
    description: t("plan.limit.description"),
    action: {
      label: t("plan.viewPlans"),
      onClick: () => {
        window.location.href = "/planos";
      },
    },
  });
  return true;
}
