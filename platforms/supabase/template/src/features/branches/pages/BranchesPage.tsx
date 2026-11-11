import { useState } from 'react';
import { toast } from 'sonner';
import { appConfig } from '@/config/app.config';
import type { SortState } from '@/lib/contracts';
import { getErrorMessage } from '@/lib/error-messages';
import { useDebouncedValue } from '@/lib/hooks/use-debounced-value';
import { useCreateBranch, useSetBranchArchived, useUpdateBranch } from '../api/branches.mutations';
import { useBranchList } from '../api/branches.queries';
import { branchMessages } from '../messages';
import { BranchListView } from '../views/BranchListView';

/**
 * Wiring only: list state, api hooks, toasts. No markup beyond the view.
 * Form errors are thrown back to the form so they appear on the right field.
 */
export function BranchesPage() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [sort, setSort] = useState<SortState | undefined>({ id: 'name', desc: false });
  const debouncedSearch = useDebouncedValue(search);
  const pageSize = appConfig.defaultPageSize;

  const list = useBranchList({ page, pageSize, search: debouncedSearch, sort, includeArchived });
  const create = useCreateBranch();
  const update = useUpdateBranch();
  const setArchived = useSetBranchArchived();

  return (
    <BranchListView
      list={{
        result: list.data,
        isLoading: list.isLoading,
        isFetching: list.isFetching,
        error: list.error,
        onRetry: () => void list.refetch(),
      }}
      page={page}
      pageSize={pageSize}
      onPageChange={setPage}
      sort={sort}
      onSortChange={(next) => { setSort(next); setPage(0); }}
      search={search}
      onSearchChange={(next) => { setSearch(next); setPage(0); }}
      includeArchived={includeArchived}
      onIncludeArchivedChange={(next) => { setIncludeArchived(next); setPage(0); }}
      onCreate={async (values) => {
        const branch = await create.mutateAsync(values);
        toast.success(`${branch.name} added`);
      }}
      onUpdate={async (id, values) => {
        await update.mutateAsync({ id, values });
        toast.success('Changes saved');
      }}
      onSetArchived={async (id, archived) => {
        try {
          await setArchived.mutateAsync({ id, archived });
          toast.success(archived ? 'Branch archived' : 'Branch restored');
        } catch (error) {
          toast.error(getErrorMessage(error, branchMessages));
          throw error;
        }
      }}
      isArchiving={setArchived.isPending}
    />
  );
}
