import clsx from "clsx";
import type { ButtonHTMLAttributes } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "secondary" | "success" | "danger";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={clsx(
        "inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
        variant === "primary" &&
          "bg-[var(--brand)] text-[color:var(--brand-fg,var(--ink))] hover:bg-[var(--brand-dark)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--brand)]",
        variant === "secondary" &&
          "border border-[color:var(--line)] bg-white text-[color:var(--ink)] hover:bg-[var(--brand-cream)]",
        variant === "success" &&
          "bg-[var(--success)] text-[color:var(--success-fg,#ffffff)] hover:opacity-90",
        variant === "danger" &&
          "bg-[#DC2626] text-white hover:bg-[#b91c1c]",
        variant === "ghost" &&
          "bg-transparent text-[color:var(--muted)] hover:bg-[var(--brand-cream)] hover:text-[color:var(--ink)] dark:text-slate-200 dark:hover:bg-slate-800",
        className,
      )}
      {...props}
    />
  );
}
