import type { ReactNode } from 'react';
import type { PermissionScope } from '@/rbac';

export type RowAction<T> = {
  label: string;
  icon?: ReactNode;
  onSelect: (row: T) => void;
  destructive?: boolean;
  /** Hide the action when the user lacks this permission for this row. */
  permission?: (row: T) => { permission: string; scope?: PermissionScope };
  /** Hide the action based on row state (e.g. "Restore" only for archived rows). */
  hidden?: (row: T) => boolean;
};
