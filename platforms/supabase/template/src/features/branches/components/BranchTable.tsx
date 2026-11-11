import type { ReactNode } from 'react';
import { Archive, ArchiveRestore, Pencil } from 'lucide-react';
import { DataTable, type RowAction } from '@/components/patterns';
import type { ListResult, SortState } from '@/lib/contracts';
import type { Branch } from '../types/branch';
import { branchColumns } from './branch-columns';

type BranchTableProps = {
  result: ListResult<Branch> | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: unknown;
  onRetry: () => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  sort: SortState | undefined;
  onSortChange: (sort: SortState | undefined) => void;
  isFiltered: boolean;
  toolbar: ReactNode;
  emptyAction?: ReactNode;
  onEdit: (branch: Branch) => void;
  onArchive: (branch: Branch) => void;
  onRestore: (branch: Branch) => void;
};

export function BranchTable({ onEdit, onArchive, onRestore, isFiltered, emptyAction, ...table }: BranchTableProps) {
  const actions: RowAction<Branch>[] = [
    {
      label: 'Edit',
      icon: <Pencil />,
      onSelect: onEdit,
      hidden: (b) => b.isArchived,
      permission: (b) => ({ permission: 'branches.update', scope: { tenantId: b.id } }),
    },
    {
      label: 'Archive',
      icon: <Archive />,
      onSelect: onArchive,
      destructive: true,
      hidden: (b) => b.isArchived,
      permission: () => ({ permission: 'branches.archive', scope: { global: true } }),
    },
    {
      label: 'Restore',
      icon: <ArchiveRestore />,
      onSelect: onRestore,
      hidden: (b) => !b.isArchived,
      permission: () => ({ permission: 'branches.archive', scope: { global: true } }),
    },
  ];

  return (
    <DataTable
      {...table}
      columns={branchColumns}
      getRowId={(b) => b.id}
      getRowLabel={(b) => b.name}
      rowActions={actions}
      empty={
        isFiltered
          ? { title: 'No branches match your search', description: 'Try a different name or code, or show archived branches.' }
          : { title: 'No branches yet', description: 'Add your first campus to start assigning staff to it.', action: emptyAction }
      }
    />
  );
}
