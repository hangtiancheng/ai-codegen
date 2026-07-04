import type { ReactNode } from "react";
import { Button } from "./button";

export type PaginationControlsProps = {
  readonly pageNumber: number;
  readonly pageSize: number;
  readonly totalPage: number;
  readonly totalRow: number;
  readonly onPageChange: (pageNumber: number) => void;
};

export function PaginationControls({
  pageNumber,
  pageSize,
  totalPage,
  totalRow,
  onPageChange,
}: PaginationControlsProps): ReactNode {
  const canGoPrevious = pageNumber > 1;
  const canGoNext = totalPage > 0 && pageNumber < totalPage;

  return (
    <nav
      aria-label="Pagination"
      className="border-border bg-card text-muted-foreground flex flex-col gap-3 rounded-xl border p-4 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <p>
        Page {pageNumber} of {Math.max(totalPage, 1)} · {totalRow} records · {pageSize} per page
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!canGoPrevious}
          onClick={() => onPageChange(pageNumber - 1)}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!canGoNext}
          onClick={() => onPageChange(pageNumber + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
