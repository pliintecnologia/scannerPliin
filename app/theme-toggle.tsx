"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type Theme = "light" | "dark";

function preferredTheme(): Theme {
  const saved = window.localStorage.getItem("scanner-pliin-theme");
  if (saved === "light" || saved === "dark") return saved;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const initial = preferredTheme();
    setTheme(initial);
    document.documentElement.dataset.theme = initial;
    document.documentElement.style.colorScheme = initial;
  }, []);

  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    window.localStorage.setItem("scanner-pliin-theme", next);
  }

  return (
    <button type="button" className="headerIcon" onClick={toggleTheme} aria-label={`Ativar tema ${theme === "dark" ? "claro" : "escuro"}`} title={`Ativar tema ${theme === "dark" ? "claro" : "escuro"}`}>
      {theme === "dark" ? <Sun size={19} /> : <Moon size={19} />}
    </button>
  );
}

export function ThemeInitializer() {
  useEffect(() => {
    const initial = preferredTheme();
    document.documentElement.dataset.theme = initial;
    document.documentElement.style.colorScheme = initial;
  }, []);
  return null;
}
