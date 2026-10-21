"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const ICON_STROKE = 1.75;

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Alternar tema claro ou escuro"
      title="Alternar tema"
      className={cn(
        "flex size-11 shrink-0 items-center justify-center rounded-button text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:size-8",
        className,
      )}
    >
      <Moon size={18} strokeWidth={ICON_STROKE} absoluteStrokeWidth aria-hidden="true" className="dark:hidden" />
      <Sun size={18} strokeWidth={ICON_STROKE} absoluteStrokeWidth aria-hidden="true" className="hidden dark:block" />
    </button>
  );
}
