import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Variation } from "@/lib/quotes";

interface VariationBadgeProps {
  variation: Variation;
  locale: string;
  /** Formatter for the absolute delta (uses user currency) */
  formatDelta?: (value: number) => string;
  size?: "sm" | "md";
}

/**
 * ▲ +2.1% (+R$ 3.20) — green for "up", red for "down", neutral for flat/none.
 * Numbers are rounded; locale-aware percent formatting.
 */
export function VariationBadge({
  variation,
  locale,
  formatDelta,
  size = "md",
}: VariationBadgeProps) {
  const { direction, pct, delta } = variation;

  if (direction === "none" || pct == null) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 whitespace-nowrap shrink-0 rounded-full bg-muted px-2 py-0.5 font-medium text-muted-foreground",
          size === "sm" ? "text-[10px]" : "text-xs",
        )}
      >
        <Minus className="h-3 w-3" />—
      </span>
    );
  }

  const color =
    direction === "up"
      ? "bg-primary/15 text-primary"
      : direction === "down"
        ? "bg-destructive/15 text-destructive"
        : "bg-muted text-muted-foreground";

  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;

  const pctLabel = new Intl.NumberFormat(locale, {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 2,
    signDisplay: "always",
  }).format(pct);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold tabular-nums",
        size === "sm" ? "text-[10px]" : "text-xs",
        color,
      )}
    >
      <Icon className="h-3 w-3" />
      {pctLabel}
      {delta != null && formatDelta && (
        <span className="ml-1 font-normal opacity-80">({formatDelta(delta)})</span>
      )}
    </span>
  );
}
