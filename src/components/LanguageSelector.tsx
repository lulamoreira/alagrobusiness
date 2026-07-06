import { useTranslation } from "react-i18next";
import { Globe, Check, ChevronDown } from "lucide-react";
import { setLang, type SupportedLang } from "@/i18n";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const LANGS: { code: SupportedLang; label: string; flag: string }[] = [
  { code: "pt-BR", label: "PT", flag: "🇧🇷" },
  { code: "en", label: "EN", flag: "🇺🇸" },
  { code: "es", label: "ES", flag: "🇪🇸" },
];

export function LanguageSelector() {
  const { i18n } = useTranslation();
  const current = (i18n.language as SupportedLang) ?? "pt-BR";
  const active = LANGS.find((l) => l.code === current) ?? LANGS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={active.label}
      >
        <Globe className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span aria-hidden>{active.flag}</span>
        <span>{active.label}</span>
        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        {LANGS.map((l) => {
          const isActive = current === l.code;
          return (
            <DropdownMenuItem
              key={l.code}
              onSelect={() => setLang(l.code)}
              className="flex items-center justify-between gap-2 text-sm"
            >
              <span className="flex items-center gap-2">
                <span aria-hidden>{l.flag}</span>
                <span className="font-medium">{l.label}</span>
              </span>
              {isActive && <Check className="h-4 w-4 text-primary" aria-hidden />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
