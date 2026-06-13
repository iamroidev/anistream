import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export interface AccentTheme {
  id: string;
  name: string;
  accent: string;
  accentDark: string;
  rgb: string;
}

export const ACCENT_THEMES: AccentTheme[] = [
  { id: "gold", name: "Royal Gold", accent: "#b8986c", accentDark: "#8e714b", rgb: "184, 152, 108" },
  { id: "burgundy", name: "Royal Burgundy", accent: "#8b3a4a", accentDark: "#6b2d3e", rgb: "139, 58, 74" },
  { id: "charcoal", name: "Charcoal", accent: "#4a4a4a", accentDark: "#2e2e2e", rgb: "74, 74, 74" },
  { id: "forest", name: "Forest", accent: "#4a7c59", accentDark: "#355a40", rgb: "74, 124, 89" },
  { id: "slate", name: "Slate", accent: "#5b6b8a", accentDark: "#3d4a63", rgb: "91, 107, 138" },
  { id: "mustard", name: "Mustard", accent: "#c4a035", accentDark: "#9a7b22", rgb: "196, 160, 53" },
];

interface ThemeContextValue {
  theme: AccentTheme;
  setThemeId: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: AccentTheme) {
  const root = document.documentElement;
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-dark", theme.accentDark);
  root.style.setProperty("--accent-rgb", theme.rgb);
  root.dataset.theme = theme.id;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeIdState] = useState(
    () => localStorage.getItem("anistream-theme") ?? "gold"
  );

  const theme = ACCENT_THEMES.find((t) => t.id === themeId) ?? ACCENT_THEMES[0];

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  function setThemeId(id: string) {
    setThemeIdState(id);
    localStorage.setItem("anistream-theme", id);
  }

  return (
    <ThemeContext.Provider value={{ theme, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
