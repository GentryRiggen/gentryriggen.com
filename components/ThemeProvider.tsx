"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);

  // Initialize theme on mount
  // Note: setState calls in this effect are required for Next.js hydration.
  // This is a standard pattern and the linter warning can be safely ignored.
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as Theme | null;
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light");

    // Required for Next.js hydration - sync with localStorage
    // These setState calls are necessary to sync client state with server render.
    // This is a standard pattern for theme initialization in Next.js apps.
    // eslint-disable-next-line -- setState in effect required for Next.js hydration
    setTheme(initialTheme);
    setMounted(true);

    const root = document.documentElement;
    if (initialTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, []);

  // Apply theme changes to the DOM when theme changes (backup in case toggleTheme doesn't run)
  useEffect(() => {
    if (!mounted) return;

    const root = document.documentElement;
    const hasDark = root.classList.contains("dark");

    if (theme === "dark" && !hasDark) {
      root.classList.add("dark");
      console.log("Effect: Added dark class");
    } else if (theme === "light" && hasDark) {
      root.classList.remove("dark");
      console.log("Effect: Removed dark class");
    }

    localStorage.setItem("theme", theme);
  }, [theme, mounted]);

  const toggleTheme = useCallback(() => {
    setTheme((prevTheme) => {
      const newTheme = prevTheme === "dark" ? "light" : "dark";
      console.log("Toggling theme from", prevTheme, "to", newTheme);

      // Immediately update DOM and localStorage
      const root = document.documentElement;
      if (newTheme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
      localStorage.setItem("theme", newTheme);
      console.log(
        "DOM updated immediately. Classes:",
        root.classList.toString()
      );

      return newTheme;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
