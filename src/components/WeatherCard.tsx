import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
  type LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

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

function buildRegiaoKey(cidade: string | null | undefined, estado: string | null | undefined) {
  const c = (cidade ?? "").trim();
  if (!c) return null;
  const e = (estado ?? "").trim();
  return `${c} - ${e}`.trim();
}

export function WeatherCard() {
  const { t, i18n } = useTranslation();
  const { profile } = useAuth();
  const regiao = buildRegiaoKey(profile?.cidade, profile?.estado);

  const { data, isLoading } = useQuery({
    queryKey: ["clima", regiao],
    enabled: !!regiao,
    queryFn: async (): Promise<ClimaRow | null> => {
      const { data } = await supabase
        .from("clima")
        .select("regiao, temperatura, condicao, previsao, atualizado_em")
        .eq("regiao", regiao!)
        .is("deleted_at", null)
        .order("atualizado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return null;
      return {
        regiao: data.regiao as string,
        temperatura: data.temperatura != null ? Number(data.temperatura) : null,
        condicao: (data.condicao as string | null) ?? null,
        previsao: (data.previsao as unknown as PrevisaoDia[] | null) ?? null,
        atualizado_em: data.atualizado_em as string,
      };
    },
  });

  const dateFmt = new Intl.DateTimeFormat(i18n.language, { weekday: "short", day: "2-digit" });
  const timeFmt = new Intl.DateTimeFormat(i18n.language, { hour: "2-digit", minute: "2-digit" });
  const numFmt = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 });

  if (!regiao) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          {t("weather.title")}
        </div>
        <p className="text-sm text-muted-foreground">{t("weather.noRegion")}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="h-24 animate-pulse rounded-xl bg-muted/30" />
      </div>
    );
  }

  if (!data || data.temperatura == null) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
          {t("weather.title")} · {regiao}
        </div>
        <p className="text-sm text-muted-foreground">{t("weather.empty")}</p>
      </div>
    );
  }

  const condKey = data.condicao ?? "weather.unknown";
  const next = (data.previsao ?? []).slice(1, 5);

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {t("weather.title")}
          </div>
          <div className="mt-1 font-display text-base font-semibold">{data.regiao}</div>
        </div>
        <ConditionIcon keyName={condKey} className="h-10 w-10 text-primary" />
      </div>

      <div className="mt-3 flex items-baseline gap-3">
        <span className="font-display text-4xl font-bold tabular-nums">
          {numFmt.format(Math.round(data.temperatura))}°
        </span>
        <span className="text-sm text-muted-foreground">{t(condKey)}</span>
      </div>

      {next.length > 0 && (
        <div className="mt-5">
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

      <div className="mt-4 text-[10px] text-muted-foreground">
        {t("weather.updatedAt")} {timeFmt.format(new Date(data.atualizado_em))}
      </div>
    </div>
  );
}
