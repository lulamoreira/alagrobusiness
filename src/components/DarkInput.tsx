import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface DarkInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const DarkInput = forwardRef<HTMLInputElement, DarkInputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-xs font-medium text-muted-foreground">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={cn(
            "w-full rounded-2xl border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/30",
            error && "border-destructive focus:border-destructive focus:ring-destructive/30",
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  },
);
DarkInput.displayName = "DarkInput";
