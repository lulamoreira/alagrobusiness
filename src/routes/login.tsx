import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/schemas";
import { AmbientGlow } from "@/components/AmbientGlow";
import { Logo } from "@/components/Logo";
import { DarkInput } from "@/components/DarkInput";
import { PillButton } from "@/components/PillButton";
import { LanguageSelector } from "@/components/LanguageSelector";
import { GoogleButton } from "@/components/GoogleButton";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (authLoading || !user) return;
    if (!profile) return;
    if (!profile.perfil_completo) navigate({ to: "/completar-cadastro", replace: true });
    else if (profile.status === "ativo") navigate({ to: "/painel", replace: true });
    else if (profile.status === "bloqueado") navigate({ to: "/bloqueado", replace: true });
    else if (profile.status === "aguardando_aprovacao") navigate({ to: "/aguardando-aprovacao", replace: true });
  }, [user, profile, authLoading, navigate]);

  if (authLoading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-pulse rounded-full bg-primary/40" />
      </div>
    );
  }


  const onSubmit = async (data: LoginInput) => {
    setSubmitting(true);
    setServerError(null);
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    setSubmitting(false);
    if (error) {
      setServerError(t("auth.error"));
      return;
    }
    navigate({ to: "/painel" });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-8">
      <AmbientGlow />
      <div className="absolute top-4 right-4"><LanguageSelector /></div>
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-border bg-card/60 p-6 backdrop-blur-md md:p-8">
        <Link to="/"><Logo size="md" /></Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{t("auth.welcome")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("auth.subtitle")}</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <DarkInput
            id="email"
            type="email"
            label={t("auth.email")}
            autoComplete="email"
            error={errors.email?.message ? t(errors.email.message) : undefined}
            {...register("email")}
          />
          <DarkInput
            id="password"
            type="password"
            label={t("auth.password")}
            autoComplete="current-password"
            error={errors.password?.message ? t(errors.password.message) : undefined}
            {...register("password")}
          />
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          <PillButton type="submit" fullWidth disabled={submitting}>
            {submitting ? t("auth.signing") : t("auth.login")}
          </PillButton>
        </form>
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("google.or")}</span>
          <span className="h-px flex-1 bg-border" />
        </div>
        <GoogleButton
          label={t("google.signin")}
          fullWidth
          onError={() => setServerError(t("google.error"))}
        />
        <div className="flex items-center justify-between text-xs">
          <button type="button" className="text-muted-foreground hover:text-foreground">
            {t("auth.forgot")}
          </button>
          <Link to="/cadastro" className="font-semibold text-primary hover:underline">
            {t("auth.signupHere")}
          </Link>
        </div>
        <div className="text-center">
          <Link to="/conheca" className="text-xs text-muted-foreground hover:text-foreground">
            {t("public.learnMore")}
          </Link>
        </div>

      </div>
    </div>
  );
}
