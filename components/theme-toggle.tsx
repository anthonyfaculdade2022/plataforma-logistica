"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "plataforma-logistica-theme";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.style.colorScheme = next ? "dark" : "light";
    localStorage.setItem(STORAGE_KEY, next ? "dark" : "light");
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`theme-toggle inline-flex items-center justify-center gap-2 rounded-xl border px-3 text-xs font-medium transition-colors ${compact ? "h-9" : "h-10 w-full"}`}
      aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}
      title={dark ? "Tema Claro" : "Tema Escuro"}
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
      {!compact && (dark ? "Tema Claro" : "Tema Escuro")}
    </button>
  );
}
