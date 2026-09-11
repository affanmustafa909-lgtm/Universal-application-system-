import type { ReactNode } from "react";
import { DistEmptyState, DistErrorBanner, DistLoadingBlock, DistPanel } from "../ui/DistUi";

/** Widget panel with independent loading / error / empty handling. */
export function DistWidgetSection({
  title,
  subtitle,
  action,
  isLoading,
  isError,
  error,
  onRetry,
  loadingLabel,
  isEmpty,
  emptyTitle,
  emptyDescription,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry: () => void;
  loadingLabel?: string;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <DistPanel title={title} subtitle={subtitle} action={action}>
      {isError ? (
        <DistErrorBanner
          message={(error as Error)?.message || "Failed to load"}
          onRetry={onRetry}
        />
      ) : isLoading ? (
        <DistLoadingBlock label={loadingLabel ?? `Loading ${title.toLowerCase()}…`} />
      ) : isEmpty ? (
        <DistEmptyState title={emptyTitle ?? "No data"} description={emptyDescription} />
      ) : (
        children
      )}
    </DistPanel>
  );
}
