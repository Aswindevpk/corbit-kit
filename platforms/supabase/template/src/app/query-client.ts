import { QueryClient } from '@tanstack/react-query';
import { AppError } from '@/lib/contracts';

const NO_RETRY = new Set(['PERMISSION_DENIED', 'NOT_AUTHENTICATED', 'VALIDATION_FAILED', 'NOT_FOUND']);

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => !(error instanceof AppError && NO_RETRY.has(error.code)) && count < 2,
    },
    mutations: { retry: false },
  },
});
