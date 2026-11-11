import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { ConfirmDialog, FormModal, PageHeader } from '@/components/patterns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ListResult, SortState } from '@/lib/contracts';
import { Can } from '@/rbac';
import { BranchTable } from '../components/BranchTable';
import { BranchForm } from '../forms/BranchForm';
import type { BranchFormValues } from '../schemas/branch-form.schema';
import type { Branch } from '../types/branch';

export type BranchListViewProps = {
  list: { result: ListResult<Branch> | undefined; isLoading: boolean; isFetching: boolean; error: unknown; onRetry: () => void };
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  sort: SortState | undefined;
  onSortChange: (sort: SortState | undefined) => void;
  search: string;
  onSearchChange: (search: string) => void;
  includeArchived: boolean;
  onIncludeArchivedChange: (value: boolean) => void;
  onCreate: (values: BranchFormValues) => Promise<unknown>;
  onUpdate: (id: string, values: BranchFormValues) => Promise<unknown>;
  onSetArchived: (id: string, archived: boolean) => Promise<unknown>;
  isArchiving: boolean;
};

type DialogState =
  | { type: 'create' }
  | { type: 'edit'; branch: Branch }
  | { type: 'archive' | 'restore'; branch: Branch }
  | null;

/** Screen body for branches. Dumb: all data and actions arrive as props. */
export function BranchListView(props: BranchListViewProps) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const close = () => setDialog(null);
  const openCreate = () => setDialog({ type: 'create' });

  const addButton = (
    <Can permission="branches.create" scope={{ global: true }}>
      <Button onClick={openCreate}><Plus /> Add branch</Button>
    </Can>
  );

  const toolbar = (
    <>
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          type="search"
          aria-label="Search branches"
          placeholder="Search by name or code"
          className="pl-8"
          value={props.search}
          onChange={(e) => props.onSearchChange(e.target.value)}
        />
      </div>
      <Button
        variant="outline"
        size="sm"
        aria-pressed={props.includeArchived}
        onClick={() => props.onIncludeArchivedChange(!props.includeArchived)}
      >
        {props.includeArchived ? 'Hide archived' : 'Show archived'}
      </Button>
    </>
  );

  const confirming = dialog?.type === 'archive' || dialog?.type === 'restore' ? dialog : null;

  return (
    <>
      <PageHeader
        title="Branches"
        description="Campuses and locations. Staff get access branch by branch."
        actions={addButton}
      />

      <BranchTable
        result={props.list.result}
        isLoading={props.list.isLoading}
        isFetching={props.list.isFetching}
        error={props.list.error}
        onRetry={props.list.onRetry}
        page={props.page}
        pageSize={props.pageSize}
        onPageChange={props.onPageChange}
        sort={props.sort}
        onSortChange={props.onSortChange}
        isFiltered={!!props.search || props.includeArchived}
        toolbar={toolbar}
        emptyAction={addButton}
        onEdit={(branch) => setDialog({ type: 'edit', branch })}
        onArchive={(branch) => setDialog({ type: 'archive', branch })}
        onRestore={(branch) => setDialog({ type: 'restore', branch })}
      />

      <FormModal
        open={dialog?.type === 'create' || dialog?.type === 'edit'}
        onOpenChange={(open) => !open && close()}
        title={dialog?.type === 'edit' ? `Edit ${dialog.branch.name}` : 'Add branch'}
      >
        {dialog?.type === 'create' && (
          <BranchForm mode="create" onCancel={close} onSubmit={async (v) => { await props.onCreate(v); close(); }} />
        )}
        {dialog?.type === 'edit' && (
          <BranchForm
            mode="edit"
            defaultValues={{ code: dialog.branch.code, name: dialog.branch.name }}
            onCancel={close}
            onSubmit={async (v) => { await props.onUpdate(dialog.branch.id, v); close(); }}
          />
        )}
      </FormModal>

      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(open) => !open && close()}
        title={confirming?.type === 'archive' ? `Archive ${confirming.branch.name}?` : `Restore ${confirming?.branch.name ?? ''}?`}
        description={
          confirming?.type === 'archive'
            ? 'Staff assigned only to this branch lose access to it until it is restored. Its records are kept.'
            : 'Staff assigned to this branch get their access back.'
        }
        confirmLabel={confirming?.type === 'archive' ? 'Archive branch' : 'Restore branch'}
        destructive={confirming?.type === 'archive'}
        isLoading={props.isArchiving}
        onConfirm={async () => {
          if (!confirming) return;
          try {
            await props.onSetArchived(confirming.branch.id, confirming.type === 'archive');
            close();
          } catch {
            // The page reports the error; keep the dialog open so the user can retry.
          }
        }}
      />
    </>
  );
}
