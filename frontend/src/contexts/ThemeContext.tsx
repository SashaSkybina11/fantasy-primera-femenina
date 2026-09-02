import { createContext, useContext, useEffect, useMemo, useState } from "react";

type ThemeContextValue = { theme: "light" | "dark"; toggleTheme: () => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">(() => localStorage.getItem("fantasy-theme") === "dark" ? "dark" : "light");
  useEffect(() => { document.documentElement.dataset.theme = theme; localStorage.setItem("fantasy-theme", theme); }, [theme]);
  const value = useMemo(() => ({ theme, toggleTheme: () => setTheme((current) => current === "light" ? "dark" : "light") }), [theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
