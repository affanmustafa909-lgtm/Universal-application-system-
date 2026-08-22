import {
  loadUiZoomIndex,
  setUiZoomIndex,
  UI_ZOOM_CHANGED_EVENT,
  UI_ZOOM_LEVELS,
  uiZoomScale,
  type UiZoomChangedDetail,
} from "../lib/uiZoom";
import { useEffect, useState } from "react";

const BTN =
  "inline-flex shrink-0 items-center justify-center rounded-md border border-[color:var(--line)] bg-[var(--card)] px-2 py-1 text-[10px] font-semibold text-[color:var(--ink)] transition hover:bg-[var(--brand-cream)] disabled:cursor-not-allowed disabled:opacity-40";

type Props = {
  /** Compact styling for tight header rows. */
  compact?: boolean;
};

export function UiZoomControls({ compact = false }: Props): JSX.Element {
  const [zoomIndex, setZoomIndex] = useState(loadUiZoomIndex);

  useEffect(() => {
    function onChanged(event: Event): void {
      const detail = (event as CustomEvent<UiZoomChangedDetail>).detail;
      if (typeof detail?.index === "number") setZoomIndex(detail.index);
      else setZoomIndex(loadUiZoomIndex());
    }
    window.addEventListener(UI_ZOOM_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(UI_ZOOM_CHANGED_EVENT, onChanged);
  }, []);

  const scale = uiZoomScale(zoomIndex);
  const pct = Math.round(scale * 100);

  return (
    <div
      className={`flex items-center gap-1 ${compact ? "" : "rounded-md border border-[color:var(--line)] bg-[var(--brand-cream)] p-0.5"}`}
      title="Zoom all screens (up to 200%)"
    >
      <button
        type="button"
        className={BTN}
        aria-label="Zoom out"
        disabled={zoomIndex === 0}
        onClick={() => setZoomIndex(setUiZoomIndex(zoomIndex - 1))}
      >
        Zoom out
      </button>
      <span
        className="min-w-[2.75rem] text-center text-[10px] font-semibold tabular-nums text-[color:var(--ink)]"
      >
        {pct}%
      </span>
      <button
        type="button"
        className={BTN}
        aria-label="Zoom in"
        disabled={zoomIndex === UI_ZOOM_LEVELS.length - 1}
        onClick={() => setZoomIndex(setUiZoomIndex(zoomIndex + 1))}
      >
        Zoom in
      </button>
    </div>
  );
}
