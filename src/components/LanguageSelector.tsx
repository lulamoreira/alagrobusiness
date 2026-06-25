import { useTranslation } from "react-i18next";
import { setLang, type SupportedLang } from "@/i18n";

const LANGS: { code: SupportedLang; label: string; flag: string }[] = [
  { code: "pt-BR", label: "PT", flag: "🇧🇷" },
  { code: "en", label: "EN", flag: "🇺🇸" },
  { code: "es", label: "ES", flag: "🇪🇸" },
];

export function LanguageSelector() {
  const { i18n } = useTranslation();
  const current = i18n.language as SupportedLang;
  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-border bg-card p-1">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          className={`rounded-full px-3 py-1 text-xs font-semibold transition-all ${
            current === l.code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
          aria-label={l.label}
        >
          <span className="mr-1">{l.flag}</span>
          {l.label}
        </button>
      ))}
    </div>
  );
}
