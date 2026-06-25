import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface PillButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  fullWidth?: boolean;
}

export const PillButton = forwardRef<HTMLButtonElement, PillButtonProps>(
  ({ variant = "primary", fullWidth, className, ...props }, ref) => {
    const variants = {
      primary:
        "bg-primary text-primary-foreground hover:brightness-110 active:scale-[0.98]",
      secondary:
        "bg-card border border-border text-foreground hover:bg-accent active:scale-[0.98]",
      ghost: "text-muted-foreground hover:text-foreground",
    };
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none",
          variants[variant],
          fullWidth && "w-full",
          className,
        )}
        {...props}
      />
    );
  },
);
PillButton.displayName = "PillButton";
