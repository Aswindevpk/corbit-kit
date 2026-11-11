import { useMutation, useQueryClient } from '@tanstack/react-query';
import { unwrap } from '@/platform';
import { supabase } from '@/platform/client';
import type { BranchFormValues } from '../schemas/branch-form.schema';
import { branchKeys } from './branches.keys';
import { parseBranch } from './branches.mappers';

function useInvalidateBranches() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: branchKeys.all });
}

export function useCreateBranch() {
  const invalidate = useInvalidateBranches();
  return useMutation({
    mutationFn: async (values: BranchFormValues) =>
      parseBranch(await unwrap(supabase.rpc('create_branch', { p_code: values.code, p_name: values.name }))),
    onSuccess: invalidate,
  });
}

export function useUpdateBranch() {
  const invalidate = useInvalidateBranches();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: BranchFormValues }) =>
      parseBranch(await unwrap(supabase.rpc('update_branch', { p_id: id, p_name: values.name }))),
    onSuccess: invalidate,
  });
}

export function useSetBranchArchived() {
  const invalidate = useInvalidateBranches();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) =>
      parseBranch(await unwrap(supabase.rpc('set_branch_archived', { p_id: id, p_archived: archived }))),
    onSuccess: invalidate,
  });
}
