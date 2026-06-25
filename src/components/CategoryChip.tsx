import { cn } from "@/lib/utils";

interface ChipProps {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}

export function CategoryChip({ selected, onClick, children, className }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-medium transition-all active:scale-[0.97]",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:border-primary/50",
        className,
      )}
    >
      {children}
    </button>
  );
}
