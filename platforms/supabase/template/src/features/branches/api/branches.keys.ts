import type { BranchListParams } from '../types/branch';

export const branchKeys = {
  all: ['branches'] as const,
  lists: () => [...branchKeys.all, 'list'] as const,
  list: (params: BranchListParams) => [...branchKeys.lists(), params] as const,
};
