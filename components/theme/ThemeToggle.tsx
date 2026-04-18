"use client";

import { useEffect, useState } from "react";
import { SunMoon } from "lucide-react";

const THEME_STORAGE_KEY = "secondbrain-theme";

type ThemeMode = "light" | "dark";

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark")
        ? "dark"
        : "light";
    }

    return "light";
  });

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  };

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/95 px-3.5 py-2 text-sm text-gray-700 shadow-sm transition hover:border-violet-300 hover:text-violet-700 dark:border-[#48505a] dark:bg-[#2c3138] dark:text-[#edf1f8] dark:hover:border-[#6670ff] dark:hover:text-white"
      aria-label="Toggle theme"
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      <SunMoon className="h-4 w-4" />
      <span>Theme</span>
    </button>
  );
}
