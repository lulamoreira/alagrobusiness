import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AmbientGlow } from "@/components/AmbientGlow";
import { Logo } from "@/components/Logo";
import { PillButton } from "@/components/PillButton";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/bloqueado")({
  ssr: false,
  component: BlockedPage,
});

function BlockedPage() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <AmbientGlow />
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-destructive/30 bg-card/60 p-8 text-center backdrop-blur-md">
        <Logo size="md" className="justify-center" />
        <h1 className="font-display text-2xl font-bold text-destructive">{t("blocked.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("blocked.message")}</p>
        <PillButton variant="secondary" onClick={signOut} fullWidth>
          {t("common.logout")}
        </PillButton>
      </div>
    </div>
  );
}
