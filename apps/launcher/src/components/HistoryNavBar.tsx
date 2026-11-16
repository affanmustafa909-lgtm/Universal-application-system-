import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useNavigationHistory } from "../hooks/useNavigationHistory";
import { businessLogoLetter } from "../lib/businessLogoLetter";
import { isSingleSystemEdition } from "../lib/edition";
import { isSuperAdminClaims } from "../lib/jwt";
import { SOFTWARE_VENDOR_NAME } from "../lib/productBrand";
import { fetchBusinessProfile } from "../pops/api/operations";
import {
  isPosFullscreenOpen,
  POS_FULLSCREEN_OPEN_EVENT,
} from "../pops/lib/posTopExperience";
import { useSessionStore } from "../stores/sessionStore";
import { SyncStatusChip } from "./SyncStatusChip";
import { ThemeToggle } from "./ThemeToggle";

const navBtnClass =
  "inline-flex shrink-0 items-center justify-center rounded-md px-2 py-1.5 text-xs font-medium transition enabled:text-slate-700 enabled:hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-40 dark:enabled:text-slate-200 dark:enabled:hover:bg-slate-800";

export function HistoryNavBar(): JSX.Element | null {
  const location = useLocation();
  const navigate = useNavigate();
  const accessToken = useSessionStore((s) => s.accessToken);
  const claims = useSessionStore((s) => s.claims);
  const { canGoBack, canGoForward, goBack, goForward } = useNavigationHistory();
  const [posImmersive, setPosImmersive] = useState(() => isPosFullscreenOpen());

  useEffect(() => {
    function onFlag(event: Event): void {
      setPosImmersive(Boolean((event as CustomEvent<{ open?: boolean }>).detail?.open));
    }
    window.addEventListener(POS_FULLSCREEN_OPEN_EVENT, onFlag);
    return () => window.removeEventListener(POS_FULLSCREEN_OPEN_EVENT, onFlag);
  }, []);

  const isSuperAdminLogin =
    location.pathname === "/login" &&
    new URLSearchParams(location.search).get("role") === "super_admin";
  const isSuperAdminArea = location.pathname.startsWith("/super-admin");
  const superAdmin = isSuperAdminClaims(claims);

  const businessProfile = useQuery({
    queryKey: ["operations", "business-profile"],
    queryFn: fetchBusinessProfile,
    enabled: Boolean(accessToken) && !superAdmin && !isSuperAdminArea,
    staleTime: 60_000,
    retry: 1,
  });

  const businessName = businessProfile.data?.name?.trim() || "";
  const centerTitle = superAdmin || isSuperAdminArea ? "Super Admin" : businessName || null;
  const centerLetter = centerTitle ? businessLogoLetter(centerTitle) : null;

  // Locked editions (Restaurant / Store / Pharmacy EXE) never expose Super Admin.
  const showSuperAdminLogin =
    !isSingleSystemEdition() && !accessToken && !isSuperAdminLogin && !isSuperAdminArea;

  // After all hooks — true full-screen POS must cover light-mode top chrome.
  if (posImmersive) return null;

  return (
    <header className="sticky top-0 z-[100] grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-slate-200 bg-white/95 px-3 py-2 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-slate-800/90 dark:bg-slate-900/95 dark:supports-[backdrop-filter]:bg-slate-900/80">
      <div className="flex min-w-0 items-center gap-1 justify-self-start">
        <button type="button" className={navBtnClass} onClick={goBack} disabled={!canGoBack} aria-label="Go back">
          ← Back
        </button>
        <button
          type="button"
          className={navBtnClass}
          onClick={goForward}
          disabled={!canGoForward}
          aria-label="Go forward"
        >
          Forward →
        </button>
      </div>

      <div className="min-w-0 justify-self-center px-2 text-center">
        <div className="inline-flex max-w-[min(70vw,28rem)] items-center gap-2 rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/15">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-[11px] font-extrabold text-slate-950">
            {centerLetter ?? "Z"}
          </span>
          <span
            className="truncate text-sm font-extrabold tracking-tight text-slate-900 dark:text-amber-100"
            title={centerTitle ?? SOFTWARE_VENDOR_NAME}
          >
            {centerTitle ?? SOFTWARE_VENDOR_NAME}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 items-center justify-end gap-2 justify-self-end">
        {showSuperAdminLogin ? (
          <button
            type="button"
            className={`${navBtnClass} font-semibold text-amber-700 dark:text-amber-400`}
            onClick={() => navigate("/login?role=super_admin")}
          >
            Super Admin Login
          </button>
        ) : null}
        <SyncStatusChip />
        <ThemeToggle compact />
      </div>
    </header>
  );
}
