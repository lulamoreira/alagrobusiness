export const SUPPORTED_THEMES = ["ecologico", "terroso", "chuva"] as const;
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
    try { localStorage.setItem(STORAGE_KEY, theme); } catch {}
  }
}

export function loadStoredTheme(): ThemeName {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (isThemeName(s)) return s;
  } catch {}
  return DEFAULT_THEME;
}

export function initThemeFromStorage() {
  applyTheme(loadStoredTheme());
}

/** Inline script string to run in <head> before hydration to avoid FOUC. */
export const THEME_BOOT_SCRIPT = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');if(t==='ecologico'||t==='terroso'||t==='chuva'){document.documentElement.setAttribute('data-theme',t);}else{document.documentElement.setAttribute('data-theme','${DEFAULT_THEME}');}}catch(e){document.documentElement.setAttribute('data-theme','${DEFAULT_THEME}');}})();`;
