import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

interface LGPDCheckboxProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
}

export function LGPDCheckbox({ checked, onChange, error }: LGPDCheckboxProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className={cn(
            "mt-0.5 h-4 w-4 rounded border-border bg-card text-primary accent-primary",
            error && "ring-2 ring-destructive",
          )}
        />
        <span className="text-xs text-muted-foreground leading-relaxed">{t("lgpd.label")}</span>
      </label>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
