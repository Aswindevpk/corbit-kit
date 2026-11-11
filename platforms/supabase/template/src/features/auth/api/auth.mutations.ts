import { useMutation } from '@tanstack/react-query';
import { appConfig } from '@/config/app.config';
import { AppError } from '@/lib/contracts';
import { toAppError } from '@/platform';
import { supabase } from '@/platform/client';
import type { SignInValues } from '../schemas/sign-in.schema';

export function useSignIn() {
  return useMutation({
    mutationFn: async (values: SignInValues) => {
      const { error } = await supabase.auth.signInWithPassword(values);
      if (error) {
        throw error.status === 400 ? new AppError('INVALID_CREDENTIALS') : toAppError(error);
      }
      // Single-device projects: revoke every other session's refresh token.
      if (appConfig.singleSession) await supabase.auth.signOut({ scope: 'others' });
    },
  });
}
