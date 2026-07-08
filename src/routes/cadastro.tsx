import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";
import { supabase } from "@/integrations/supabase/client";
import { signupSchema, type SignupInput } from "@/lib/schemas";
import { AmbientGlow } from "@/components/AmbientGlow";
import { Logo } from "@/components/Logo";
import { DarkInput } from "@/components/DarkInput";
import { PillButton } from "@/components/PillButton";
import { SegmentedToggle } from "@/components/SegmentedToggle";
import { CategoryChip } from "@/components/CategoryChip";
import { LGPDCheckbox } from "@/components/LGPDCheckbox";
import { LanguageSelector } from "@/components/LanguageSelector";
import { GoogleButton } from "@/components/GoogleButton";

const CATEGORIES = ["fruta", "grao", "legumes", "vegetal"] as const;

// Slugs vindos das páginas /para/... e slugs diretos aceitos
const PERFIL_MAP: Record<string, SignupInput["tipo_perfil"]> = {
  comprador: "comprador",
  vendedor: "vendedor",
  produtor: "vendedor",
  lojista: "lojista",
  marca: "marca",
};

const searchSchema = z.object({
  perfil: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/cadastro")({
  ssr: false,
  validateSearch: zodValidator(searchSchema),
  component: SignupPage,
});

function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { perfil } = Route.useSearch();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const initialTipo = PERFIL_MAP[perfil?.toLowerCase() ?? ""] ?? "comprador";

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      tipo_perfil: initialTipo,
      pais: "Brasil",
      categorias_interesse: [],
      lgpd_aceito: false as unknown as true,
    },
  });

  // Sincroniza mudanças na querystring (ex.: navegação entre funis)
  useEffect(() => {
    const mapped = PERFIL_MAP[perfil?.toLowerCase() ?? ""];
    if (mapped) setValue("tipo_perfil", mapped);
  }, [perfil, setValue]);

  const onSubmit = async (data: SignupInput) => {
    setSubmitting(true);
    setServerError(null);
    // Importante: tipo_perfil é sanitizado no servidor pelo trigger handle_new_user.
    // Marca e lojista entram como 'aguardando_aprovacao'.
    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
        data: {
          tipo_perfil: data.tipo_perfil,
          nome_completo: data.nome_completo,
          telefone: data.telefone,
          pais: data.pais,
          estado: data.estado,
          cidade: data.cidade,
          categorias_interesse: data.categorias_interesse,
          lgpd_aceito: true,
          termos_versao: "v1",
        },
      },
    });
    setSubmitting(false);
    if (error) {
      setServerError(t("signup.error"));
      return;
    }
    navigate({ to: "/painel" });
  };

  const perfilOptions = [
    { value: "comprador" as const, label: t("signup.buyer") },
    { value: "vendedor" as const, label: t("signup.seller") },
    { value: "lojista" as const, label: t("signup.shop") },
    { value: "marca" as const, label: t("signup.brand") },
  ];

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-8">
      <AmbientGlow />
      <div className="absolute top-4 right-4"><LanguageSelector /></div>
      <div className="w-full max-w-2xl space-y-6 rounded-3xl border border-border bg-card/60 p-6 backdrop-blur-md md:p-8">
        <Link to="/"><Logo size="md" /></Link>
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">{t("signup.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("signup.subtitle")}</p>
        </div>

        <GoogleButton
          label={t("google.signup")}
          fullWidth
          onError={() => setServerError(t("google.error"))}
        />
        <div className="flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase tracking-wider text-muted-foreground">{t("google.or")}</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              {t("signup.profileType")}
            </label>
            <Controller
              control={control}
              name="tipo_perfil"
              render={({ field }) => (
                <SegmentedToggle
                  className="flex-wrap"
                  value={field.value}
                  onChange={field.onChange}
                  options={perfilOptions}
                />
              )}
            />
            {(initialTipo === "lojista" || initialTipo === "marca") && (
              <p className="mt-2 text-xs text-muted-foreground">{t("signup.approvalNotice")}</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <DarkInput
              label={t("signup.name")}
              error={errors.nome_completo?.message ? t(errors.nome_completo.message) : undefined}
              {...register("nome_completo")}
            />
            <DarkInput
              label={t("signup.phone")}
              placeholder="+55 ..."
              {...register("telefone")}
            />
            <DarkInput label={t("signup.country")} {...register("pais")} />
            <DarkInput label={t("signup.state")} {...register("estado")} />
            <DarkInput label={t("signup.city")} {...register("cidade")} />
            <DarkInput
              type="email"
              label={t("signup.email")}
              autoComplete="email"
              error={errors.email?.message ? t(errors.email.message) : undefined}
              {...register("email")}
            />
            <DarkInput
              type="password"
              label={t("signup.password")}
              autoComplete="new-password"
              error={errors.password?.message ? t(errors.password.message) : undefined}
              {...register("password")}
            />
            <DarkInput
              type="password"
              label={t("signup.confirmPassword")}
              autoComplete="new-password"
              error={errors.confirmPassword?.message ? t(errors.confirmPassword.message) : undefined}
              {...register("confirmPassword")}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              {t("signup.categories")}
            </label>
            <Controller
              control={control}
              name="categorias_interesse"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => {
                    const selected = field.value.includes(c);
                    return (
                      <CategoryChip
                        key={c}
                        selected={selected}
                        onClick={() =>
                          field.onChange(
                            selected ? field.value.filter((v) => v !== c) : [...field.value, c],
                          )
                        }
                      >
                        {t(`categories.${c}`)}
                      </CategoryChip>
                    );
                  })}
                </div>
              )}
            />
            {errors.categorias_interesse?.message && (
              <p className="mt-1 text-xs text-destructive">{t(errors.categorias_interesse.message)}</p>
            )}
          </div>

          <Controller
            control={control}
            name="lgpd_aceito"
            render={({ field }) => (
              <LGPDCheckbox
                checked={Boolean(field.value)}
                onChange={(v) => field.onChange(v)}
                error={errors.lgpd_aceito?.message ? t(errors.lgpd_aceito.message) : undefined}
              />
            )}
          />

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

          <PillButton type="submit" fullWidth disabled={submitting}>
            {submitting ? t("signup.submitting") : t("signup.submit")}
          </PillButton>

          <p className="text-center text-xs text-muted-foreground">
            {t("signup.hasAccount")}{" "}
            <Link to="/login" className="font-semibold text-primary hover:underline">
              {t("signup.loginHere")}
            </Link>
          </p>
          <p className="text-center">
            <Link to="/conheca" className="text-xs text-muted-foreground hover:text-foreground">
              {t("public.learnMore")}
            </Link>
          </p>

        </form>
      </div>
    </div>
  );
}
