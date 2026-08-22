import type { ReactNode } from "react";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger" | "info";
}): JSX.Element {
  const cls =
    tone === "success"
      ? "bg-[var(--success)]/20 text-[color:var(--ink)] ring-[color:var(--success)]/40"
      : tone === "warning"
        ? "bg-[var(--warning)]/35 text-[color:var(--ink)] ring-[color:var(--warning)]/50"
        : tone === "danger"
          ? "bg-red-50 text-[#DC2626] ring-[#DC2626]/25"
          : tone === "info"
            ? "bg-[var(--brand-cream)] text-[color:var(--brand-dark)] ring-[color:var(--brand)]/30"
            : "bg-[var(--bg)] text-[color:var(--muted)] ring-[color:var(--line)]";
  return (
    <span
      data-badge-tone={tone}
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${cls}`}
    >
      {children}
    </span>
  );
}
