import { useEffect, useRef } from "react";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return Boolean(el.closest("[contenteditable='true']"));
}

export type SaleShortcutHandlers = {
  onCustomerFocus: () => void;
  onProductFocus: () => void;
  onHold: () => void;
  onBook: () => void;
  onBookAndPrint: () => void;
  onBookAndPay?: () => void;
  onNewSale: () => void;
  onEscape: () => void;
  onDeleteLine: () => void;
  onOrders?: () => void;
};

/**
 * Sale Window keyboard map.
 * Skips Delete when typing in inputs; prevents Ctrl/Cmd+N default in Tauri/desktop.
 */
export function useSaleShortcuts(handlers: SaleShortcutHandlers, enabled = true): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;

    function onKey(e: KeyboardEvent) {
      const h = handlersRef.current;
      const typing = isTypingTarget(e.target);

      if (e.key === "F2") {
        e.preventDefault();
        h.onCustomerFocus();
        return;
      }
      if (e.key === "F4") {
        e.preventDefault();
        h.onProductFocus();
        return;
      }
      if (e.key === "F7") {
        e.preventDefault();
        h.onOrders?.();
        return;
      }
      if (e.key === "F8") {
        e.preventDefault();
        h.onHold();
        return;
      }
      if (e.key === "F9") {
        e.preventDefault();
        h.onBook();
        return;
      }
      if (e.key === "F10") {
        e.preventDefault();
        h.onBookAndPrint();
        return;
      }
      if (e.key === "F11") {
        e.preventDefault();
        h.onBookAndPay?.();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "n" || e.key === "N")) {
        e.preventDefault();
        h.onNewSale();
        return;
      }
      if (e.key === "Escape") {
        h.onEscape();
        return;
      }
      if (e.key === "Delete" && !typing) {
        e.preventDefault();
        h.onDeleteLine();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}
