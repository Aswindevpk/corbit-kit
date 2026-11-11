import { createColumnHelper } from '@tanstack/react-table';
import type { Branch } from '../types/branch';
import { BranchStatusBadge } from './BranchStatusBadge';

const column = createColumnHelper<Branch>();
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

// Column ids double as sort ids; api/branches.mappers.ts maps them to backend columns.
export const branchColumns = [
  column.accessor('code', {
    header: 'Code',
    enableSorting: true,
    cell: (info) => <span className="font-medium tabular-nums">{info.getValue()}</span>,
  }),
  column.accessor('name', { header: 'Name', enableSorting: true }),
  column.accessor('isArchived', {
    header: 'Status',
    cell: (info) => <BranchStatusBadge isArchived={info.getValue()} />,
  }),
  column.accessor('createdAt', {
    header: 'Added',
    enableSorting: true,
    cell: (info) => <span className="text-muted-foreground">{dateFormat.format(info.getValue())}</span>,
  }),
];
