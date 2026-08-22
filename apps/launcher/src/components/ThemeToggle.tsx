import { useState } from "react";
import { useActiveSystemId } from "../hooks/useActiveSystemId";
import {
  applyIceCreamScheme,
  getStoredIceCreamScheme,
  ICE_CREAM_SCHEMES,
  type IceCreamScheme,
} from "../lib/iceCreamScheme";
import { useThemeStore } from "../stores/themeStore";
import type { ThemeMode } from "../lib/theme";

type Props = {
  compact?: boolean;
};

const options: { id: ThemeMode; label: string; icon: string }[] = [
  { id: "light", label: "Light", icon: "☀" },
  { id: "dark", label: "Dark", icon: "☾" },
];

export function ThemeToggle({ compact = false }: Props): JSX.Element {
  const mode = useThemeStore((s) => s.mode);
  const setMode = useThemeStore((s) => s.setMode);
  const systemId = useActiveSystemId();
  const isIceCream = systemId === "ice-cream-bar";
  const [scheme, setScheme] = useState<IceCreamScheme>(getStoredIceCreamScheme);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div
        className="inline-flex rounded-md border border-[color:var(--line)] bg-[var(--brand-cream)] p-0.5"
        role="group"
        aria-label="Theme"
      >
        {options.map((option) => {
          const active = mode === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={active}
              title={`${option.label} mode`}
              onClick={() => setMode(option.id)}
              className={[
                "inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition",
                active
                  ? "bg-[var(--brand)] text-[color:var(--brand-fg,#fff)] shadow-sm"
                  : "text-[color:var(--muted)] hover:bg-[var(--card)] hover:text-[color:var(--ink)]",
              ].join(" ")}
            >
              <span aria-hidden>{option.icon}</span>
              {compact ? null : <span>{option.label}</span>}
            </button>
          );
        })}
      </div>

      {isIceCream ? (
        <div
          className="inline-flex rounded-md border border-[color:var(--line)] bg-[var(--brand-cream)] p-0.5"
          role="group"
          aria-label="Color scheme"
        >
          {ICE_CREAM_SCHEMES.map((option) => {
            const active = scheme === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                title={option.label}
                onClick={() => {
                  applyIceCreamScheme(option.id);
                  setScheme(option.id);
                }}
                className={[
                  "inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-semibold transition",
                  active
                    ? "bg-[var(--brand)] text-[color:var(--brand-fg,#fff)] shadow-sm"
                    : "text-[color:var(--muted)] hover:bg-[var(--card)] hover:text-[color:var(--ink)]",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className="h-2 w-2 rounded-full border border-black/20"
                  style={{ background: option.swatch }}
                />
                {compact ? option.short : option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
