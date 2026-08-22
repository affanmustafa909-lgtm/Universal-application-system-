/** Shared Tailwind classes — tokens come from CSS variables (Ice Cream Bar pastel vs default). */

export const fieldInputClass =
  "rounded-lg border border-[color:var(--line)] bg-white px-3 py-2 text-sm text-[color:var(--ink)] outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--brand)] focus:ring-1 focus:ring-[color:var(--brand)]/25 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500";

export const fieldSelectClass = fieldInputClass;

export const panelClass =
  "rounded-xl border border-[color:var(--line)] bg-white shadow-card dark:border-slate-800 dark:bg-slate-900/40";

export const cardClass =
  "rounded-xl border border-[color:var(--line)] bg-white shadow-card dark:border-slate-800/70 dark:bg-slate-900/30";

export const panelTitleClass = "text-sm font-semibold text-[color:var(--ink)] dark:text-white";

export const pageTitleClass = "text-base font-semibold tracking-tight text-[color:var(--ink)] dark:text-white";

export const headingClass = "text-xl font-semibold tracking-tight text-[color:var(--ink)] dark:text-white";

export const mutedClass = "text-[color:var(--muted)] dark:text-slate-400";

export const tableOrderRefClass = "table-order-ref font-mono text-sm font-semibold";

export const tableCellPrimaryClass = "font-medium text-[color:var(--ink)] dark:text-slate-100";

export const tableCellAmountClass =
  "tabular-nums font-semibold text-[color:var(--ink)] dark:text-slate-100";

export const emptyStateBoxClass =
  "rounded-xl border border-dashed border-[color:var(--line)] px-4 py-8 text-center text-sm text-[color:var(--muted)] dark:border-slate-700 dark:text-slate-400";

export const linkActionClass =
  "font-medium text-[color:var(--brand-dark)] underline-offset-2 hover:text-[color:var(--brand)] hover:underline dark:text-amber-300";

export const linkDangerClass =
  "font-medium text-[#DC2626] underline-offset-2 hover:text-red-700 hover:underline dark:text-red-300";

export const linkWarningClass =
  "font-medium text-[color:var(--brand-dark)] underline-offset-2 hover:text-[color:var(--brand)] hover:underline dark:text-amber-300";

export const linkSuccessClass =
  "font-medium text-[color:var(--success)] underline-offset-2 hover:text-emerald-700 hover:underline dark:text-emerald-300";

export const accentValueClass = "font-medium text-[color:var(--brand-dark)] dark:text-amber-200";

export const amberPillActiveClass =
  "bg-[var(--nav-active,var(--brand))] font-semibold text-[color:var(--nav-active-fg,var(--brand-fg,var(--ink)))] shadow-sm dark:bg-amber-500 dark:text-slate-950";

export const pillInactiveClass =
  "bg-white text-[color:var(--ink)] ring-1 ring-[color:var(--line)] hover:bg-[var(--brand-cream)] dark:bg-slate-900/60 dark:text-slate-400 dark:ring-slate-700 dark:hover:bg-slate-800 dark:hover:text-amber-200";

export const subtleClass = "text-[color:var(--muted)] dark:text-slate-300";

export const modalBackdropClass =
  "fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--ink)]/30 p-4 dark:bg-black/65";

export const modalBackdropRaisedClass =
  "fixed inset-0 z-[60] flex items-center justify-center bg-[color:var(--ink)]/30 p-4 dark:bg-black/65";

export const modalPanelClass =
  "flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-[color:var(--line)] bg-white shadow-panel dark:border-slate-700 dark:bg-slate-900";

export const modalHeaderClass =
  "flex items-start justify-between gap-3 border-b border-[color:var(--line)] px-4 py-3 dark:border-slate-800";

export const modalTitleClass = "text-base font-semibold text-[color:var(--ink)] dark:text-white";

export const modalSubtitleClass = "mt-0.5 text-xs text-[color:var(--muted)] dark:text-slate-400";

export const modalCloseBtnClass =
  "shrink-0 rounded-md border border-[color:var(--line)] px-2 py-1 text-xs font-medium text-[color:var(--ink)] transition hover:bg-[var(--brand-cream)] disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800";

export const modalBackBtnClass =
  "mb-3 rounded-md border border-[color:var(--line)] px-2.5 py-1 text-xs font-medium text-[color:var(--muted)] transition hover:bg-[var(--brand-cream)] hover:text-[color:var(--ink)] disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800";

export const modalSectionCardClass =
  "rounded-lg border border-[color:var(--line)] bg-white px-4 py-3 text-left shadow-card transition hover:border-[color:var(--brand)] hover:bg-[var(--brand-cream)] dark:border-slate-600 dark:bg-slate-800";

export const modalSectionCardDisabledClass =
  "cursor-not-allowed rounded-lg border border-[color:var(--line)] bg-[var(--bg)] px-4 py-3 text-left dark:border-slate-700 dark:bg-slate-800/50";

export const modalSectionTitleClass = "text-sm font-semibold text-[color:var(--ink)] dark:text-white";

export const modalSectionTitleDisabledClass = "text-sm font-semibold text-[color:var(--muted)]";

export const modalSectionMetaClass = "mt-1 text-xs text-[color:var(--muted)]";

export const modalSectionMetaDisabledClass = "mt-1 text-xs text-[color:var(--muted)]";

export const modalTableBtnClass =
  "rounded-lg border border-[color:var(--line)] bg-white px-3 py-3 text-center text-[color:var(--ink)] shadow-card transition hover:border-[color:var(--brand)] hover:bg-[var(--brand-cream)] disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100";

export const modalBodyTextClass = "text-sm text-[color:var(--muted)] dark:text-slate-400";

export const filterBarClass =
  "flex flex-wrap items-center gap-2 rounded-xl border border-[color:var(--line)] bg-white px-3 py-2.5 dark:border-slate-700 dark:bg-slate-900/50";

export const moduleSearchClass =
  "h-8 min-w-[10rem] flex-1 rounded-lg border border-[color:var(--line)] bg-white px-3 text-xs text-[color:var(--ink)] outline-none transition placeholder:text-[color:var(--muted)] focus:border-[color:var(--brand)] focus:ring-1 focus:ring-[color:var(--brand)]/25 dark:border-slate-700/80 dark:bg-slate-950/80 dark:text-white sm:max-w-xs";

export const countBadgeClass =
  "rounded-full bg-[var(--brand-cream)] px-2.5 py-1 text-[11px] tabular-nums text-[color:var(--muted)] dark:bg-slate-800/80 dark:text-slate-400";

export const noticeSuccessClass =
  "rounded-lg border border-[color:var(--success)]/40 bg-[var(--success)]/15 px-3 py-2 text-sm text-[color:var(--ink)]";

export const noticeWarningClass =
  "rounded-lg border border-[color:var(--warning)]/50 bg-[var(--brand-cream)] px-3 py-2 text-sm text-[color:var(--brand-dark)]";

export const noticeErrorClass =
  "rounded-lg border border-[#DC2626]/25 bg-red-50 px-3 py-2 text-sm text-[#DC2626]";

export const screenCenterClass =
  "flex min-h-screen items-center justify-center bg-[var(--bg)] text-sm text-[color:var(--muted)] dark:bg-slate-950 dark:text-slate-400";

export const loginCardClass =
  "rounded-xl border border-[color:var(--line)] bg-[var(--card)] p-6 text-[color:var(--ink)] shadow-panel";
