import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import ptBR from "./locales/pt-BR.json";
import en from "./locales/en.json";
import es from "./locales/es.json";

export const SUPPORTED_LANGS = ["pt-BR", "en", "es"] as const;
export type SupportedLang = (typeof SUPPORTED_LANGS)[number];

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      "pt-BR": { translation: ptBR },
      en: { translation: en },
      es: { translation: es },
    },
    lng: "pt-BR",
    fallbackLng: "pt-BR",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
}

export function detectAndApplyLang() {
  if (typeof window === "undefined") return;
  const stored = localStorage.getItem("alagro_lang") as SupportedLang | null;
  if (stored && SUPPORTED_LANGS.includes(stored)) {
    i18n.changeLanguage(stored);
    return;
  }
  const nav = navigator.language;
  let pick: SupportedLang = "pt-BR";
  if (nav.startsWith("en")) pick = "en";
  else if (nav.startsWith("es")) pick = "es";
  i18n.changeLanguage(pick);
}

export function setLang(lang: SupportedLang) {
  i18n.changeLanguage(lang);
  if (typeof window !== "undefined") localStorage.setItem("alagro_lang", lang);
}

export default i18n;
