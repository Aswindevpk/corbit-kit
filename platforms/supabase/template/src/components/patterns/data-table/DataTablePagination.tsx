import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Props = { page: number; pageSize: number; total: number; onPageChange: (page: number) => void };

export function DataTablePagination({ page, pageSize, total, onPageChange }: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="flex items-center justify-between gap-4 border-t px-3 py-2.5 text-sm text-muted-foreground">
      <p aria-live="polite">
        {from}–{to} of {total}
      </p>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => onPageChange(page - 1)} disabled={page === 0}>
          <ChevronLeft /> Previous
        </Button>
        <span className="px-2 tabular-nums">
          {page + 1} / {pageCount}
        </span>
        <Button variant="ghost" size="sm" onClick={() => onPageChange(page + 1)} disabled={page + 1 >= pageCount}>
          Next <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
