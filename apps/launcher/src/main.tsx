import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { clearDeviceInstall } from "./lib/deviceInstall";
import { getApiBaseUrl } from "./lib/apiBase";
import { ensureLocalStorageHeadroom, reclaimLocalStorageSpace } from "./lib/localStorageGuard";
import "./index.css";
import "./theme-overrides.css";
import "./floor-modal.css";
import "./segmented-control.css";
import "./date-filters-bar.css";
import "./dashboard-charts.css";

// Clear device lock / reclaim quota before stores hydrate so login can persist.
try {
  const params = new URLSearchParams(window.location.search);
  if (params.get("reset-install") === "1") {
    clearDeviceInstall();
    localStorage.removeItem("platform-system-v1");
    localStorage.removeItem("platform-session-v1");
  }
  if (params.get("clear-storage") === "1") {
    reclaimLocalStorageSpace({ keepSession: false });
    localStorage.removeItem("platform-session-v1");
    localStorage.removeItem("platform-system-v1");
  }
  ensureLocalStorageHeadroom();
} catch {
  // ignore storage errors
}

void fetch(`${getApiBaseUrl()}/health`, { method: "GET" }).catch(() => {
  /* ignore — login/sync will retry */
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 0,
      staleTime: 15_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
