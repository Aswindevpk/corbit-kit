import type { ListParams } from '@/lib/contracts';

// Domain types: what the UI needs, in the UI's naming. Platform-neutral.
// Never import generated database types into components/forms/views.

export type Branch = {
  id: string;
  code: string;
  name: string;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type BranchSortField = 'name' | 'code' | 'createdAt';

export type BranchListParams = ListParams & { includeArchived: boolean };
