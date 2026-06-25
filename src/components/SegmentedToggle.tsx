import { cn } from "@/lib/utils";

interface SegmentedToggleProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}

export function SegmentedToggle<T extends string>({ options, value, onChange, className }: SegmentedToggleProps<T>) {
  return (
    <div className={cn("inline-flex rounded-full border border-border bg-card p-1", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-full px-4 py-2 text-sm font-medium transition-all",
            value === opt.value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
