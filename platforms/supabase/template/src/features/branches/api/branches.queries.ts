import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { unwrap } from '@/platform';
import { supabase } from '@/platform/client';
import type { BranchListParams } from '../types/branch';
import { branchKeys } from './branches.keys';
import { parseBranchList, toListArgs } from './branches.mappers';

export function useBranchList(params: BranchListParams) {
  return useQuery({
    queryKey: branchKeys.list(params),
    queryFn: async () => parseBranchList(await unwrap(supabase.rpc('list_branches', toListArgs(params)))),
    placeholderData: keepPreviousData, // UI-STATE-OFFLINE-SLOW-NETWORK: keep old rows while paging
  });
}
