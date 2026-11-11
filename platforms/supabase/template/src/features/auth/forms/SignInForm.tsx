import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { TextField } from '@/components/patterns';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/error-messages';
import { signInSchema, type SignInValues } from '../schemas/sign-in.schema';

const messages = { INVALID_CREDENTIALS: "That email and password don't match. Check them and try again." };

export function SignInForm({ onSubmit }: { onSubmit: (values: SignInValues) => Promise<unknown> }) {
  const form = useForm<SignInValues>({ resolver: zodResolver(signInSchema), defaultValues: { email: '', password: '' } });

  const submit = async (values: SignInValues) => {
    try {
      await onSubmit(values);
    } catch (error) {
      form.setError('root', { message: getErrorMessage(error, messages) });
    }
  };

  return (
    <form onSubmit={form.handleSubmit(submit)} noValidate className="grid gap-4">
      <TextField control={form.control} name="email" label="Email" type="email" autoComplete="email" autoFocus />
      <TextField control={form.control} name="password" label="Password" type="password" autoComplete="current-password" />
      {form.formState.errors.root && (
        <p role="alert" className="text-sm text-destructive">{form.formState.errors.root.message}</p>
      )}
      <Button type="submit" isLoading={form.formState.isSubmitting} className="mt-2">
        Sign in
      </Button>
    </form>
  );
}
