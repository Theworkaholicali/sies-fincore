import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { SkeletonBlock, EmptyState } from "@/components/kit";
import { Inbox } from "lucide-react";

/**
 * Enterprise data table.
 * columns: [{ key, header, align, render(row), sortable, className }]
 */
export function DataTable({
  columns,
  rows = [],
  loading = false,
  onRowClick,
  emptyTitle = "No records found",
  emptyMessage = "There are no records to display for the current filters.",
  testId,
  page,
  pages,
  total,
  onPageChange,
  search,
  onSearch,
  searchPlaceholder = "Search",
  toolbar,
}) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState("asc");

  const sorted = sortKey
    ? [...rows].sort((a, b) => {
        const av = a[sortKey];
        const bv = b[sortKey];
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp =
          typeof av === "number" && typeof bv === "number"
            ? av - bv
            : String(av).localeCompare(String(bv));
        return sortDir === "asc" ? cmp : -cmp;
      })
    : rows;

  const toggleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {(onSearch || toolbar) && (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between p-4 border-b border-border">
          {onSearch ? (
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                data-testid={testId ? `${testId}-search` : undefined}
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9 h-9 bg-background"
              />
            </div>
          ) : (
            <div />
          )}
          {toolbar}
        </div>
      )}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm" data-testid={testId}>
          <thead>
            <tr className="border-b border-border bg-muted/50">
              {columns.map((c) => (
                <th
                  key={c.key}
                  onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                  className={cn(
                    "px-4 py-3 text-xs uppercase tracking-wider font-semibold text-muted-foreground whitespace-nowrap sticky top-0",
                    c.align === "right" ? "text-right" : "text-left",
                    c.sortable && "cursor-pointer select-none hover:text-foreground"
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex items-center gap-1",
                      c.align === "right" && "flex-row-reverse"
                    )}
                  >
                    {c.header}
                    {c.sortable && sortKey === c.key &&
                      (sortDir === "asc" ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      ))}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/60">
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      <SkeletonBlock className="h-3.5 w-full max-w-[120px]" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading &&
              sorted.map((row, i) => (
                <tr
                  key={row.id || i}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "border-b border-border/60 transition-colors fc-row-in",
                    onRowClick && "cursor-pointer hover:bg-accent/60"
                  )}
                  style={{ animationDelay: `${Math.min(i, 12) * 20}ms` }}
                  data-testid={testId ? `${testId}-row-${i}` : undefined}
                >
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-4 py-3 whitespace-nowrap",
                        c.align === "right" && "text-right num",
                        c.className
                      )}
                    >
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!loading && sorted.length === 0 && (
        <EmptyState title={emptyTitle} message={emptyMessage} icon={Inbox} />
      )}
      {pages > 1 && (
        <div className="flex items-center justify-between p-4 border-t border-border">
          <span className="text-xs text-muted-foreground">
            Page {page} of {pages} {total != null && `(${total} records)`}
          </span>
          <div className="flex items-center gap-1">
            <button
              data-testid={testId ? `${testId}-prev` : undefined}
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-accent"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <button
              data-testid={testId ? `${testId}-next` : undefined}
              disabled={page >= pages}
              onClick={() => onPageChange(page + 1)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium disabled:opacity-40 hover:bg-accent"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
