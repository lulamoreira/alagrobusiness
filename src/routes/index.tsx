import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AmbientGlow } from "@/components/AmbientGlow";
import { Logo } from "@/components/Logo";
import { PillButton } from "@/components/PillButton";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  ssr: false,
  component: SplashPage,
});

function SplashPage() {
  const { t } = useTranslation();
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user && profile) {
      if (profile.status === "ativo") navigate({ to: "/painel" });
      else if (profile.status === "bloqueado") navigate({ to: "/bloqueado" });
      else if (profile.status === "aguardando_aprovacao") navigate({ to: "/aguardando-aprovacao" });
    }
  }, [user, profile, loading, navigate]);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6">
      <AmbientGlow />
      <div className="absolute top-4 right-4">
        <LanguageSelector />
      </div>

      <div className="w-full max-w-md text-center space-y-8">
        <Logo size="lg" className="justify-center" />
        <div className="space-y-3">
          <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">
            {t("common.tagline")}
          </h1>
          <p className="text-sm text-muted-foreground">{t("splash.subtitle")}</p>
        </div>

        <div className="flex flex-col gap-3 pt-4">
          <Link to="/login">
            <PillButton variant="primary" fullWidth>
              {t("splash.enter")}
            </PillButton>
          </Link>
          <Link to="/cadastro">
            <PillButton variant="secondary" fullWidth>
              {t("splash.create")}
            </PillButton>
          </Link>
        </div>
      </div>
    </div>
  );
}
