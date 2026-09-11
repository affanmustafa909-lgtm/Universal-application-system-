import { DistButton, DistSelect } from "../ui/DistUi";

export function DistPagination({
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages?: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
}): JSX.Element {
  const pages = Math.max(1, totalPages ?? Math.ceil(total / Math.max(1, pageSize)));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
      <div>
        Showing {from}–{to} of {total}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onPageSizeChange ? (
          <label className="inline-flex items-center gap-1">
            Rows
            <DistSelect
              className="w-auto py-1"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </DistSelect>
          </label>
        ) : null}
        <DistButton variant="secondary" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Prev
        </DistButton>
        <span className="tabular-nums text-slate-700 dark:text-slate-300">
          {page} / {pages}
        </span>
        <DistButton
          variant="secondary"
          disabled={page >= pages}
          onClick={() => onPageChange(page + 1)}
        >
          Next
        </DistButton>
      </div>
    </div>
  );
}
