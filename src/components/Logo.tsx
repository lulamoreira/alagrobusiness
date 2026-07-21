import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  to?: string;
}

export function Logo({ className, size = "md", to }: LogoProps) {
  const sizes = {
    sm: "text-lg",
    md: "text-2xl",
    lg: "text-4xl md:text-5xl",
  };
  const content = (
    <div className={cn("flex items-center gap-2 font-display font-bold tracking-tight", sizes[size], className)}>
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
          <path d="M12 2C8 6 5 9 5 13a7 7 0 0 0 14 0c0-4-3-7-7-11Z" fill="currentColor" />
        </svg>
      </span>
      <span className="whitespace-nowrap text-foreground">ENTREPOSTO<span className="text-primary">VIRTUAL</span></span>
    </div>
  );
  if (!to) return content;
  return (
    <Link to={to} className="inline-block">
      {content}
    </Link>
  );
}
