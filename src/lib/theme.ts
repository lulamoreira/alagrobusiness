export const SUPPORTED_THEMES = ["ecologico", "terroso", "chuva", "classico"] as const;
export type ThemeName = (typeof SUPPORTED_THEMES)[number];
export const DEFAULT_THEME: ThemeName = "ecologico";
const STORAGE_KEY = "alagro_theme";

export function isThemeName(v: unknown): v is ThemeName {
  return typeof v === "string" && (SUPPORTED_THEMES as readonly string[]).includes(v);
}

export function applyTheme(theme: ThemeName) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

export function setTheme(theme: ThemeName) {
  applyTheme(theme);
  if (typeof window !== "undefined") {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
  }
}

export function loadStoredTheme(): ThemeName {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (isThemeName(s)) return s;
  } catch { /* ignore */ }
  return DEFAULT_THEME;
}

export function initThemeFromStorage() {
  applyTheme(loadStoredTheme());
}

/** Inline script to run in <head> pre-hydration to prevent theme flash. */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t==='ecologico'||t==='terroso'||t==='chuva'||t==='classico'){document.documentElement.setAttribute('data-theme',t);}else{document.documentElement.setAttribute('data-theme','${DEFAULT_THEME}');}}catch(e){document.documentElement.setAttribute('data-theme','${DEFAULT_THEME}');}})();`;

export interface ThemeSwatch {
  bg: string;
  card: string;
  primary: string;
  fg: string;
}

export const THEME_SWATCHES: Record<ThemeName, ThemeSwatch> = {
  ecologico: { bg: "#0B130E", card: "#121C15", primary: "#C2F04A", fg: "#EAF1EA" },
  terroso:   { bg: "#15100A", card: "#221A11", primary: "#E3A83C", fg: "#F1EADF" },
  chuva:     { bg: "#0C1319", card: "#13202A", primary: "#56B6E6", fg: "#E6EEF4" },
  classico:  { bg: "#4CA935", card: "#3E8E2B", primary: "#F5E625", fg: "#FFFFFF" },
};

