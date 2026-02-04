import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useContext } from "react";
import { Capacitor } from "@capacitor/core";

// Check if running as native iOS app
function isNativeIOSApp(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
  } catch {
    return false;
  }
}

export function ThemeToggle() {
  // iOS native: Hide theme toggle completely (dark mode only)
  if (isNativeIOSApp()) {
    return null;
  }

  // Simple toggle between light and dark
  const toggleTheme = () => {
    const root = document.documentElement;
    const isDark = root.classList.contains("dark");
    if (isDark) {
      root.classList.remove("dark");
      localStorage.setItem("ogym-theme", "light");
    } else {
      root.classList.add("dark");
      localStorage.setItem("ogym-theme", "dark");
    }
  };

  const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className="relative"
      onClick={toggleTheme}
      data-testid="button-theme-toggle"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
