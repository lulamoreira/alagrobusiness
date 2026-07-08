import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  Zap,
  HelpCircle,
  MapPin,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  buildRegiaoKey,
  listMeusLocais,
  addLocal,
  type ClimaLocal,
} from "@/lib/climaLocais";
import { useEffect } from "react";

type PrevisaoDia = {
  data: string;
  min: number | null;
  max: number | null;
  weather_code: number | null;
  condicao: string;
};

type ClimaRow = {
  regiao: string;
  temperatura: number | null;
  condicao: string | null;
  previsao: PrevisaoDia[] | null;
  atualizado_em: string;
};

const CONDITION_ICONS: Record<string, LucideIcon> = {
  "weather.clear": Sun,
  "weather.partlyCloudy": CloudSun,
  "weather.cloudy": Cloud,
  "weather.fog": CloudFog,
  "weather.drizzle": CloudDrizzle,
  "weather.rain": CloudRain,
  "weather.snow": CloudSnow,
  "weather.thunderstorm": Zap,
  "weather.unknown": HelpCircle,
};

function ConditionIcon({ keyName, className }: { keyName: string; className?: string }) {
  const Icon = CONDITION_ICONS[keyName] ?? HelpCircle;
  return <Icon className={className} />;
}

export function useMeusClimaLocais() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["clima_locais", user?.id],
    enabled: !!user?.id,
    queryFn: () => listMeusLocais(user!.id),
  });

  // Seed com a cidade do perfil se lista vazia
  const seed = useMutation({
    mutationFn: async () => {
      if (!user?.id || !profile?.cidade) return;
      await addLocal(user.id, profile.cidade, profile.estado ?? null);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clima_locais", user?.id] }),
  });

  useEffect(() => {
    if (!query.data || query.isLoading) return;
    if (query.data.length === 0 && profile?.cidade && !seed.isPending) {
      seed.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data, query.isLoading, profile?.cidade]);

  return query;
}

function useClimaByRegioes(regioes: string[]) {
  return useQuery({
    queryKey: ["clima_multi", regioes.slice().sort().join("|")],
    enabled: regioes.length > 0,
    queryFn: async (): Promise<Record<string, ClimaRow>> => {
      const { data } = await supabase
        .from("clima")
        .select("regiao, temperatura, condicao, previsao, atualizado_em")
        .in("regiao", regioes)
        .is("deleted_at", null)
        .order("atualizado_em", { ascending: false });
      const out: Record<string, ClimaRow> = {};
      for (const row of data ?? []) {
        const r = row.regiao as string;
        if (out[r]) continue;
        out[r] = {
          regiao: r,
          temperatura: row.temperatura != null ? Number(row.temperatura) : null,
          condicao: (row.condicao as string | null) ?? null,
          previsao: (row.previsao as unknown as PrevisaoDia[] | null) ?? null,
          atualizado_em: row.atualizado_em as string,
        };
      }
      return out;
    },
  });
}

function SingleWeather({
  local,
  clima,
}: {
  local: { regiao: string; cidade: string; estado: string | null };
  clima: ClimaRow | undefined;
}) {
  const { t, i18n } = useTranslation();
  const dateFmt = new Intl.DateTimeFormat(i18n.language, { weekday: "short", day: "2-digit" });
  const timeFmt = new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit" });
  const numFmt = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 });

  if (!clima || clima.temperatura == null) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          {t("weather.title")} · {local.regiao}
        </div>
        <p className="text-sm text-muted-foreground">{t("weather.empty")}</p>
      </div>
    );
  }
  const condKey = clima.condicao ?? "weather.unknown";
  const next = (clima.previsao ?? []).slice(1, 5);
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:items-center">
        <div className="flex items-start justify-between gap-3 md:justify-start md:gap-5">
          <div className="min-w-0">
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("weather.title")}
            </div>
            <div className="mt-1 truncate font-display text-base font-semibold">{clima.regiao}</div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-4xl font-bold tabular-nums leading-none">
                {numFmt.format(Math.round(clima.temperatura))}°
              </span>
              <span className="text-sm text-muted-foreground">{t(condKey)}</span>
            </div>
          </div>
          <ConditionIcon keyName={condKey} className="h-10 w-10 shrink-0 text-primary" />
        </div>

        {next.length > 0 && (
          <div className="min-w-0">
            <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
              {t("weather.forecast")}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {next.map((d) => (
                <div
                  key={d.data}
                  className="rounded-xl border border-border/60 bg-background/40 p-2 text-center"
                >
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {dateFmt.format(new Date(d.data))}
                  </div>
                  <ConditionIcon
                    keyName={d.condicao ?? "weather.unknown"}
                    className="mx-auto my-1 h-5 w-5 text-primary/90"
                  />
                  <div className="text-xs tabular-nums">
                    <span className="font-semibold">
                      {d.max != null ? `${numFmt.format(Math.round(d.max))}°` : "—"}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      {d.min != null ? `${numFmt.format(Math.round(d.min))}°` : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="mt-4 text-[10px] text-muted-foreground">
        {t("weather.updatedAt")} {timeFmt.format(new Date(clima.atualizado_em))}
      </div>
    </div>
  );
}

export function WeatherCard() {
  const { t } = useTranslation();
  const { profile } = useAuth();
  const meus = useMeusClimaLocais();

  const fallbackRegiao = buildRegiaoKey(profile?.cidade, profile?.estado);
  const locais: Array<{ id: string; regiao: string; cidade: string; estado: string | null }> =
    (meus.data ?? []).length > 0
      ? (meus.data as ClimaLocal[]).map((l) => ({
          id: l.id,
          regiao: l.regiao,
          cidade: l.cidade,
          estado: l.estado,
        }))
      : fallbackRegiao
        ? [
            {
              id: "profile",
              regiao: fallbackRegiao,
              cidade: profile!.cidade!,
              estado: profile?.estado ?? null,
            },
          ]
        : [];

  const climaQuery = useClimaByRegioes(locais.map((l) => l.regiao));

  if (locais.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          {t("weather.title")}
        </div>
        <p className="text-sm text-muted-foreground">{t("weather.noRegion")}</p>
        <Link
          to="/configuracoes"
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary"
        >
          <Plus className="h-3.5 w-3.5" /> {t("weather.addLocation")}
        </Link>
      </div>
    );
  }

  if (meus.isLoading || climaQuery.isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="h-24 animate-pulse rounded-xl bg-muted/30" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {locais.map((l) => (
        <SingleWeather key={l.id} local={l} clima={climaQuery.data?.[l.regiao]} />
      ))}
      <div>
        <Link
          to="/configuracoes"
          className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <MapPin className="h-3.5 w-3.5" /> {t("weather.manageLocations")}
        </Link>
      </div>
    </div>
  );
}
