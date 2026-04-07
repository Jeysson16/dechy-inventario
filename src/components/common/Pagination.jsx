import React, { useMemo } from "react";

const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 30],
}) => {
  const pages = useMemo(() => {
    const result = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i += 1) result.push(i);
      return result;
    }

    if (currentPage <= 3) {
      result.push(1, 2, 3, 4, "...", totalPages);
    } else if (currentPage >= totalPages - 2) {
      result.push(
        1,
        "...",
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      );
    } else {
      result.push(
        1,
        "...",
        currentPage - 1,
        currentPage,
        currentPage + 1,
        "...",
        totalPages,
      );
    }

    return result;
  }, [currentPage, totalPages]);

  if (totalPages <= 1 && !onPageSizeChange) return null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-4 py-4 bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="size-11 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-800 transition-all"
        >
          <span className="material-symbols-outlined">chevron_left</span>
        </button>

        {pages.map((page, index) => (
          <button
            key={`${page}-${index}`}
            type="button"
            onClick={() => typeof page === "number" && onPageChange(page)}
            disabled={page === "..."}
            className={`size-9 rounded-[14px] text-xs font-black transition-all ${
              page === currentPage
                ? "bg-primary text-white shadow-lg shadow-primary/30"
                : "text-slate-500 hover:text-primary"
            } ${page === "..." ? "cursor-default opacity-50" : ""}`}
          >
            {page}
          </button>
        ))}

        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="size-11 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-800 transition-all"
        >
          <span className="material-symbols-outlined">chevron_right</span>
        </button>
      </div>

      {onPageSizeChange && (
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-slate-500 dark:text-slate-400">
            Mostrar
          </span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 outline-none"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="text-sm text-slate-500 dark:text-slate-400">
            registros
          </span>
        </div>
      )}
    </div>
  );
};

export default Pagination;
