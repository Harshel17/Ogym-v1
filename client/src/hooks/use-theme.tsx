import { createContext, useContext, useEffect, useState } from "react";
import { updateStatusBarForTheme } from "@/lib/capacitor-init";
import { Capacitor } from "@capacitor/core";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
  isNativeIOS: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = "ogym-theme";

// Check if running as native iOS app
function isNativeIOSApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const isNativeIOS = isNativeIOSApp();
  
  // iOS native: Always dark mode, no user preference
  const [theme, setThemeState] = useState<Theme>(() => {
    if (isNativeIOS) return "dark";
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(THEME_KEY) as Theme | null;
      return stored || "dark"; // Default to dark
    }
    return "dark";
  });

  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const root = document.documentElement;
    
    const applyTheme = (newTheme: "light" | "dark") => {
      if (newTheme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
      setResolvedTheme(newTheme);
      // Update iOS/Android status bar to match theme
      updateStatusBarForTheme(newTheme === "dark");
    };

    // iOS native: Force dark mode always
    if (isNativeIOS) {
      applyTheme("dark");
      return;
    }

    // Web/Android: Allow theme switching
    applyTheme(theme === "system" ? "dark" : theme);
  }, [theme, isNativeIOS]);

  const setTheme = (newTheme: Theme) => {
    // iOS native: Ignore theme changes, always stay dark
    if (isNativeIOS) return;
    
    setThemeState(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme, isNativeIOS }}>
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
