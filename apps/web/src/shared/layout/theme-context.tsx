"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggle: () => {},
});

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // The site always opens in dark mode. We deliberately do NOT restore a saved
  // preference on load — the light toggle is an in-session convenience that
  // resets to dark on the next reload/visit.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    // Guarantee the DOM matches the dark default even if a stale data-theme
    // attribute lingered (e.g. from a previous build's persistence behaviour).
    document.documentElement.setAttribute("data-theme", "dark");
  }, []);

  function toggle() {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      return next;
    });
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}
