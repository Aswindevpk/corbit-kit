import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField } from '@/components/patterns';
import { Button } from '@/components/ui/button';
import { AppError } from '@/lib/contracts';
import { getErrorMessage } from '@/lib/error-messages';
import { branchMessages } from '../messages';
import { branchFormSchema, type BranchFormValues } from '../schemas/branch-form.schema';

type BranchFormProps = {
  mode: 'create' | 'edit';
  defaultValues?: BranchFormValues;
  /** Resolve on success. Reject with AppError to show the message on the matching field. */
  onSubmit: (values: BranchFormValues) => Promise<unknown>;
  onCancel: () => void;
};

const FIELDS = ['code', 'name'] as const;

export function BranchForm({ mode, defaultValues, onSubmit, onCancel }: BranchFormProps) {
  const form = useForm<BranchFormValues>({
    resolver: zodResolver(branchFormSchema),
    defaultValues: defaultValues ?? { code: '', name: '' },
  });

  const submit = async (values: BranchFormValues) => {
    try {
      await onSubmit(values);
    } catch (error) {
      const message = getErrorMessage(error, branchMessages);
      const field = error instanceof AppError ? FIELDS.find((f) => f === error.field) : undefined;
      form.setError(field ?? 'root', { message });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate className="grid gap-4">
      <TextField
        control={form.control}
        name="code"
        label="Branch code"
        description={mode === 'create' ? "Short and permanent, like CLT or KOC-2. It can't be changed later." : undefined}
        disabled={mode === 'edit'}
        autoComplete="off"
        autoFocus={mode === 'create'}
      />
      <TextField control={form.control} name="name" label="Name" autoComplete="off" autoFocus={mode === 'edit'} />

      {form.formState.errors.root && (
        <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={form.formState.isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" isLoading={form.formState.isSubmitting}>
          {mode === 'create' ? 'Add branch' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
