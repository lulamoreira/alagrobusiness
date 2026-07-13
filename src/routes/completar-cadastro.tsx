import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { AmbientGlow } from "@/components/AmbientGlow";
import { Logo } from "@/components/Logo";
import { DarkInput } from "@/components/DarkInput";
import { PillButton } from "@/components/PillButton";
import { CategoryChip } from "@/components/CategoryChip";
import { LGPDCheckbox } from "@/components/LGPDCheckbox";
import { LanguageSelector } from "@/components/LanguageSelector";
import { geocodeCep } from "@/lib/geocode";

export const Route = createFileRoute("/completar-cadastro")({
  ssr: false,
  component: CompleteProfilePage,
});

const CATEGORIES = ["fruta", "grao", "legumes", "vegetal"] as const;
const THEMES = ["soja", "cafe", "milho", "clima", "mercado", "tecnologia", "pecuaria", "trigo", "algodao", "geral"] as const;
const PROFILE_TYPES = ["comprador", "vendedor", "lojista", "marca"] as const;
const LANGS = ["pt-BR", "en", "es"] as const;
const CURRENCIES = ["BRL", "USD", "EUR"] as const;
const DOLLAR_TYPES = ["comercial", "turismo", "paralelo"] as const;

function CompleteProfilePage() {
  const { t } = useTranslation();
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const [tipo, setTipo] = useState<(typeof PROFILE_TYPES)[number]>("comprador");
  const [nome, setNome] = useState("");
  const [estado, setEstado] = useState("");
  const [cidade, setCidade] = useState("");
  const [cep, setCep] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cats, setCats] = useState<string[]>([]);
  const [temas, setTemas] = useState<string[]>([]);
  const [idioma, setIdioma] = useState<string>("pt-BR");
  const [moeda, setMoeda] = useState<string>("BRL");
  const [tipoDolar, setTipoDolar] = useState<string>("comercial");
  const [lgpd, setLgpd] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [geoInfo, setGeoInfo] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number | null; lng: number | null }>({ lat: null, lng: null });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (profile?.perfil_completo) {
      navigate({ to: "/" });
      return;
    }
    if (profile) {
      setNome((p) => p || profile.nome_completo || "");
      setEstado((p) => p || profile.estado || "");
      setCidade((p) => p || profile.cidade || "");
      setCep((p) => p || profile.cep || "");
      setTelefone((p) => p || profile.telefone || "");
      setIdioma(profile.idioma_preferido || "pt-BR");
      setMoeda(profile.moeda_preferida || "BRL");
      setTipoDolar(profile.tipo_dolar_preferido || "comercial");
    }
  }, [user, profile, loading, navigate]);

  const toggle = (list: string[], v: string) =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  const handleCepBlur = async () => {
    const digits = (cep || "").replace(/\D+/g, "");
    if (digits.length !== 8) return;
    const geo = await geocodeCep(digits);
    if (!geo) return;
    if (geo.cidade) setCidade((p) => p || geo.cidade!);
    if (geo.estado) setEstado((p) => p || geo.estado!);
    setCoords({ lat: geo.latitude, lng: geo.longitude });
    if (geo.cidade || geo.estado) {
      setGeoInfo(
        t("geo.detected", {
          cidade: geo.cidade ?? "—",
          estado: geo.estado ?? "—",
        }),
      );
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!nome.trim()) e.nome = "validation.required";
    if (!estado.trim()) e.estado = "validation.required";
    if (!cidade.trim()) e.cidade = "validation.required";
    if (cats.length === 0) e.cats = "validation.minOneCategory";
    if (!lgpd) e.lgpd = "validation.lgpdRequired";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("complete_profile", {
      p_tipo_perfil: tipo,
      p_nome_completo: nome,
      p_telefone: telefone,
      p_estado: estado,
      p_cidade: cidade,
      p_cep: cep,
      p_categorias: cats,
      p_idioma: idioma,
      p_moeda: moeda,
      p_tipo_dolar: tipoDolar,
      p_temas: temas,
      p_lgpd: lgpd,
      p_termos_versao: "v1",
    });
    setSubmitting(false);
    if (error) {
      setServerError(t("onboarding.error"));
      return;
    }
    await refreshProfile();
    const status = data as string;
    if (status === "aguardando_aprovacao") navigate({ to: "/aguardando-aprovacao" });
    else navigate({ to: "/painel" });
  };

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-10 w-10 animate-pulse rounded-full bg-primary/40" />
      </div>
    );
  }

  const Pill = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full border px-4 py-2 text-sm font-medium transition-all " +
        (active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </button>
  );

  return (
    <div className="relative min-h-screen px-4 py-8">
      <AmbientGlow />
      <div className="absolute top-4 right-4"><LanguageSelector /></div>
      <div className="mx-auto w-full max-w-3xl space-y-6 rounded-3xl border border-border bg-card/60 p-6 backdrop-blur-md md:p-10">
        <Logo size="md" />
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">{t("onboarding.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.subtitle")}</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              {t("signup.profileType")}
            </label>
            <div className="flex flex-wrap gap-2">
              {PROFILE_TYPES.map((p) => (
                <Pill key={p} active={tipo === p} onClick={() => setTipo(p)}>
                  {t(`signup.${p === "comprador" ? "buyer" : p === "vendedor" ? "seller" : p}`, {
                    defaultValue: p.charAt(0).toUpperCase() + p.slice(1),
                  })}
                </Pill>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <DarkInput
              label={t("signup.name")}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              error={errors.nome ? t(errors.nome) : undefined}
            />
            <DarkInput
              label={t("signup.phone")}
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="+55 ..."
            />
            <DarkInput
              label={t("signup.state")}
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
              error={errors.estado ? t(errors.estado) : undefined}
            />
            <DarkInput
              label={t("signup.city")}
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              error={errors.cidade ? t(errors.cidade) : undefined}
            />
            <DarkInput
              label={t("onboarding.cep")}
              value={cep}
              onChange={(e) => setCep(e.target.value)}
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              {t("signup.categories")}
            </label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <CategoryChip
                  key={c}
                  selected={cats.includes(c)}
                  onClick={() => setCats((s) => toggle(s, c))}
                >
                  {t(`categories.${c}`)}
                </CategoryChip>
              ))}
            </div>
            {errors.cats && <p className="mt-1 text-xs text-destructive">{t(errors.cats)}</p>}
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">
              {t("onboarding.themes")}
            </label>
            <div className="flex flex-wrap gap-2">
              {THEMES.map((th) => (
                <Pill key={th} active={temas.includes(th)} onClick={() => setTemas((s) => toggle(s, th))}>
                  {t(`themes.${th}`)}
                </Pill>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">{t("settings.language")}</label>
              <div className="flex flex-wrap gap-2">
                {LANGS.map((l) => (
                  <Pill key={l} active={idioma === l} onClick={() => setIdioma(l)}>{l}</Pill>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">{t("settings.currency")}</label>
              <div className="flex flex-wrap gap-2">
                {CURRENCIES.map((c) => (
                  <Pill key={c} active={moeda === c} onClick={() => setMoeda(c)}>{c}</Pill>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-medium text-muted-foreground">{t("settings.dollarType")}</label>
              <div className="flex flex-wrap gap-2">
                {DOLLAR_TYPES.map((d) => (
                  <Pill key={d} active={tipoDolar === d} onClick={() => setTipoDolar(d)}>
                    {t(`settings.${d}`)}
                  </Pill>
                ))}
              </div>
            </div>
          </div>

          <LGPDCheckbox
            checked={lgpd}
            onChange={setLgpd}
            error={errors.lgpd ? t(errors.lgpd) : undefined}
          />

          {serverError && <p className="text-sm text-destructive">{serverError}</p>}

          <div className="flex flex-col-reverse gap-3 md:flex-row md:items-center md:justify-between">
            <button
              type="button"
              onClick={signOut}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {t("common.logout")}
            </button>
            <PillButton type="submit" disabled={submitting} className="md:w-auto">
              {submitting ? t("onboarding.submitting") : t("onboarding.submit")}
            </PillButton>
          </div>
        </form>
      </div>
    </div>
  );
}
