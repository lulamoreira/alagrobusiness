import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SegmentedToggle } from "@/components/SegmentedToggle";
import { PillButton } from "@/components/PillButton";
import { LanguageSelector } from "@/components/LanguageSelector";
import { setLang, type SupportedLang } from "@/i18n";
import {
  SUPPORTED_THEMES,
  THEME_SWATCHES,
  setTheme,
  loadStoredTheme,
  type ThemeName,
} from "@/lib/theme";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: ConfigPage,
});

function ConfigPage() {
  const { t, i18n } = useTranslation();
  const { profile, refreshProfile } = useAuth();
  const [moeda, setMoeda] = useState<"BRL" | "USD" | "EUR">(profile?.moeda_preferida ?? "BRL");
  const [tipoDolar, setTipoDolar] = useState<"comercial" | "turismo" | "paralelo">(
    profile?.tipo_dolar_preferido ?? "comercial",
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [tema, setTemaState] = useState<ThemeName>(loadStoredTheme());

  useEffect(() => {
    // Sync from profile prefs once loaded
    if (!profile) return;
    (async () => {
      const { data } = await supabase
        .from("preferencias")
        .select("tema")
        .eq("usuario_id", profile.id)
        .maybeSingle();
      if (data?.tema && (SUPPORTED_THEMES as readonly string[]).includes(data.tema)) {
        setTemaState(data.tema as ThemeName);
      }
    })();
  }, [profile]);

  const onPickTheme = (next: ThemeName) => {
    setTemaState(next);
    setTheme(next); // apply + localStorage immediately
  };

  const save = async () => {
    if (!profile) return;
    setSaving(true);
    await supabase
      .from("profiles")
      .update({
        moeda_preferida: moeda,
        tipo_dolar_preferido: tipoDolar,
        idioma_preferido: i18n.language as SupportedLang,
      })
      .eq("id", profile.id);
    await supabase
      .from("preferencias")
      .update({
        moeda,
        tipo_dolar: tipoDolar,
        idioma: i18n.language as SupportedLang,
        tema,
      })
      .eq("usuario_id", profile.id);
    setSaving(false);
    setSaved(true);
    await refreshProfile();
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="font-display text-2xl font-bold md:text-3xl">{t("settings.title")}</h1>

      <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("settings.language")}
          </div>
          <LanguageSelector />
        </div>

        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("settings.currency")}
          </div>
          <SegmentedToggle
            value={moeda}
            onChange={setMoeda}
            options={[
              { value: "BRL", label: "BRL" },
              { value: "USD", label: "USD" },
              { value: "EUR", label: "EUR" },
            ]}
          />
        </div>

        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("settings.dollarType")}
          </div>
          <SegmentedToggle
            value={tipoDolar}
            onChange={setTipoDolar}
            options={[
              { value: "comercial", label: t("settings.comercial") },
              { value: "turismo", label: t("settings.turismo") },
              { value: "paralelo", label: t("settings.paralelo") },
            ]}
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <PillButton onClick={save} disabled={saving}>
            {t("common.save")}
          </PillButton>
          {saved && <span className="text-sm text-primary">{t("settings.saved")}</span>}
        </div>
      </div>
    </div>
  );
}

// Garante que o setter de idioma é utilizado (vínculo intencional).
void setLang;
