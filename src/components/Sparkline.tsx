import { useTranslation } from "react-i18next";
import { LineChart, Line, ResponsiveContainer, Tooltip, YAxis, XAxis } from "recharts";

export interface SparklinePoint {
  data: string;
  value: number;
}

interface SparklineProps {
  points: SparklinePoint[];
  /** Tooltip currency formatter — receives raw numeric value */
  formatValue: (value: number) => string;
  height?: number;
}

/**
 * Minimal line chart in theme colors. Renders nothing chrome-heavy: just a
 * lime line + a hover tooltip. Falls back to a translated "insufficient data"
 * panel when there are fewer than 2 points.
 */
export function Sparkline({ points, formatValue, height = 80 }: SparklineProps) {
  const { t, i18n } = useTranslation();

  if (!points || points.length < 2) {
    return (
      <div
        style={{ height }}
        className="flex items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/30 text-xs text-muted-foreground"
      >
        {t("quote.insufficient")}
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
          <XAxis dataKey="data" hide />
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Tooltip
            cursor={{ stroke: "hsl(var(--border))", strokeDasharray: "3 3" }}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 10,
              fontSize: 11,
              padding: "6px 8px",
              color: "hsl(var(--popover-foreground))",
            }}
            labelFormatter={(label: string) =>
              new Date(label).toLocaleDateString(i18n.language, {
                day: "2-digit",
                month: "short",
              })
            }
            formatter={(value: number) => [formatValue(value), t("quote.value")]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
