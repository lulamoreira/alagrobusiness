import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Plus, Trash2, Search } from "lucide-react";
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
import {
  listMeusLocais,
  addLocal,
  removeLocal,
  geocodeCity,
  type GeocodeHit,
} from "@/lib/climaLocais";

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
  const [destaqueSec, setDestaqueSec] = useState<number>(3);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase
        .from("preferencias")
        .select("tema, destaque_scroll_segundos")
        .eq("usuario_id", profile.id)
        .maybeSingle();
      if (data?.tema && (SUPPORTED_THEMES as readonly string[]).includes(data.tema)) {
        setTemaState(data.tema as ThemeName);
      }
      if (typeof data?.destaque_scroll_segundos === "number") {
        setDestaqueSec(data.destaque_scroll_segundos);
      }
    })();
  }, [profile]);

  const onPickTheme = (next: ThemeName) => {
    setTemaState(next);
    setTheme(next);
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
    if (tema !== "classico") {
      await supabase
        .from("preferencias")
        .update({
          moeda,
          tipo_dolar: tipoDolar,
          idioma: i18n.language as SupportedLang,
          tema,
        })
        .eq("usuario_id", profile.id);
    }
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

        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t("settings.theme")}
          </div>
          <div className="grid grid-cols-3 gap-3">
            {SUPPORTED_THEMES.map((name) => {
              const sw = THEME_SWATCHES[name];
              const active = tema === name;
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => onPickTheme(name)}
                  aria-pressed={active}
                  className={`group flex flex-col items-stretch gap-2 rounded-2xl border p-2 text-left transition ${
                    active ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/50"
                  }`}
                >
                  <div
                    className="relative h-16 w-full overflow-hidden rounded-xl"
                    style={{ background: sw.bg }}
                  >
                    <div
                      className="absolute inset-2 rounded-lg"
                      style={{ background: sw.card }}
                    />
                    <div
                      className="absolute bottom-3 right-3 h-4 w-8 rounded-full"
                      style={{ background: sw.primary }}
                    />
                  </div>
                  <div className="px-1 text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    {t(`settings.themes.${name}`)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <PillButton onClick={save} disabled={saving}>
            {t("common.save")}
          </PillButton>
          {saved && <span className="text-sm text-primary">{t("settings.saved")}</span>}
        </div>
      </div>

      <WeatherLocationsSection />
    </div>
  );
}

function WeatherLocationsSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<GeocodeHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);

  const meus = useQuery({
    queryKey: ["clima_locais", user?.id],
    enabled: !!user?.id,
    queryFn: () => listMeusLocais(user!.id),
  });

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const r = await geocodeCity(q, ctrl.signal);
        setHits(r);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const jaExiste = useMemo(() => {
    const set = new Set((meus.data ?? []).map((l) => l.regiao));
    return set;
  }, [meus.data]);

  const onAdd = async (hit: GeocodeHit) => {
    if (!user?.id) return;
    setBusy(true);
    try {
      await addLocal(user.id, hit.name, hit.admin1);
      setQuery("");
      setHits([]);
      qc.invalidateQueries({ queryKey: ["clima_locais", user.id] });
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async (id: string) => {
    setBusy(true);
    try {
      await removeLocal(id);
      qc.invalidateQueries({ queryKey: ["clima_locais", user?.id] });
    } catch (err) {
      console.error("removeLocal failed:", err);
      toast.error(t("weatherLocations.removeError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <div>
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
          <MapPin className="h-4 w-4 text-primary" />
          {t("weatherLocations.title")}
        </div>
        <p className="text-xs text-muted-foreground">{t("weatherLocations.subtitle")}</p>
      </div>

      <div className="space-y-2">
        {(meus.data ?? []).length === 0 && !meus.isLoading && (
          <p className="text-sm text-muted-foreground">{t("weatherLocations.empty")}</p>
        )}
        {(meus.data ?? []).map((l) => (
          <div
            key={l.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/40 px-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{l.cidade}</div>
              {l.estado && (
                <div className="truncate text-xs text-muted-foreground">{l.estado}</div>
              )}
            </div>
            <button
              type="button"
              onClick={() => onRemove(l.id)}
              disabled={busy}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground hover:border-destructive/60 hover:text-destructive disabled:opacity-50"
              aria-label={t("weatherLocations.remove")}
            >
              <Trash2 className="h-3.5 w-3.5" /> {t("weatherLocations.remove")}
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {t("weatherLocations.addLabel")}
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("weatherLocations.searchPlaceholder")}
            className="w-full rounded-xl border border-border bg-background px-9 py-2 text-sm outline-none focus:border-primary"
          />
        </div>
        {query.trim().length >= 2 && (
          <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-background/60">
            {searching && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {t("weatherLocations.searching")}
              </div>
            )}
            {!searching && hits.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                {t("weatherLocations.noResults")}
              </div>
            )}
            {hits.map((h, idx) => {
              const regiao = `${h.name} - ${h.admin1 ?? ""}`.trim();
              const exists = jaExiste.has(regiao);
              return (
                <button
                  key={`${h.name}-${h.latitude}-${h.longitude}-${idx}`}
                  type="button"
                  disabled={busy || exists}
                  onClick={() => onAdd(h)}
                  className="flex w-full items-center justify-between gap-3 border-b border-border/40 px-3 py-2 text-left last:border-b-0 hover:bg-accent disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{h.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {h.admin1 ?? ""} {h.country_code ? `· ${h.country_code}` : ""}
                    </div>
                  </div>
                  {!exists && <Plus className="h-4 w-4 shrink-0 text-primary" />}
                  {exists && (
                    <span className="text-[10px] uppercase text-muted-foreground">
                      {t("weatherLocations.alreadyAdded")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

void setLang;
