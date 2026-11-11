import type { ReactNode } from "react"
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type Updater,
} from "@tanstack/react-table"
import { ArrowDown, ArrowUp, ArrowsDownUp } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ListResult, SortState } from "@/lib/contracts"
import { getErrorMessage } from "@/lib/error-messages"
import { cn } from "@/lib/utils"
import { EmptyState, type EmptyStateProps } from "../EmptyState"
import { ErrorState } from "../ErrorState"
import { DataTablePagination } from "./DataTablePagination"
import { RowActionsMenu } from "./RowActionsMenu"
import type { RowAction } from "./types"

export type DataTableProps<T> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- TanStack column value types vary per column
  columns: ColumnDef<T, any>[]
  result: ListResult<T> | undefined
  getRowId: (row: T) => string
  /** Used in the actions button's accessible name. */
  getRowLabel: (row: T) => string
  isLoading: boolean
  isFetching?: boolean
  error?: unknown
  onRetry?: () => void
  page: number
  pageSize: number
  onPageChange: (page: number) => void
  sort?: SortState
  onSortChange?: (sort: SortState | undefined) => void
  rowActions?: RowAction<T>[]
  empty: EmptyStateProps
  toolbar?: ReactNode
}

/**
 * Server-driven table: the backend pages and sorts, this renders. You only
 * ever define `columns`; filtering, pagination and sorting come free.
 * Columns opt in to sorting with `enableSorting: true`.
 */
export function DataTable<T>(props: DataTableProps<T>) {
  const { columns, result, rowActions, sort, onSortChange } = props

  const allColumns: ColumnDef<T>[] = rowActions?.length
    ? [
        ...columns,
        {
          id: "__actions",
          header: () => <span className="sr-only">Actions</span>,
          cell: ({ row }) => (
            <div className="flex justify-end">
              <RowActionsMenu row={row.original} actions={rowActions} label={props.getRowLabel(row.original)} />
            </div>
          ),
        },
      ]
    : columns

  const sorting: SortingState = sort ? [sort] : []
  const handleSorting = (updater: Updater<SortingState>) => {
    const next = typeof updater === "function" ? updater(sorting) : updater
    onSortChange?.(next[0])
  }

  const table = useReactTable({
    data: result?.rows ?? [],
    columns: allColumns,
    getRowId: props.getRowId,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    enableSortingRemoval: true,
    defaultColumn: { enableSorting: false },
    state: { sorting },
    onSortingChange: handleSorting,
  })

  const colCount = allColumns.length
  const showError = !!props.error && !result

  return (
    <div className="rounded-sm border bg-card">
      {props.toolbar && <div className="flex flex-wrap items-center gap-2 border-b p-3">{props.toolbar}</div>}

      {showError ? (
        <ErrorState title="Couldn't load this list" description={getErrorMessage(props.error)} onRetry={props.onRetry} />
      ) : (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id} className="hover:bg-transparent">
                {group.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const dir = header.column.getIsSorted()
                  const content = flexRender(header.column.columnDef.header, header.getContext())
                  return (
                    <TableHead key={header.id} aria-sort={dir ? (dir === "asc" ? "ascending" : "descending") : undefined}>
                      {canSort ? (
                        <Button variant="ghost" size="sm" className="-ml-2.5 h-8" onClick={header.column.getToggleSortingHandler()}>
                          {content}
                          {dir === "asc" ? <ArrowUp /> : dir === "desc" ? <ArrowDown /> : <ArrowsDownUp className="opacity-40" />}
                        </Button>
                      ) : (
                        content
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className={cn(props.isFetching && !props.isLoading && "opacity-60 transition-opacity")}>
            {props.isLoading && !result
              ? Array.from({ length: 5 }, (_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: colCount }, (_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full max-w-40" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      )}

      {result && result.rows.length === 0 && !showError && <EmptyState {...props.empty} />}
      {result && result.total > 0 && (
        <DataTablePagination page={props.page} pageSize={props.pageSize} total={result.total} onPageChange={props.onPageChange} />
      )}
    </div>
  )
}
