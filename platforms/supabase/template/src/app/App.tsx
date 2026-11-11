import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/platform';
import { PermissionProvider } from '@/rbac';
import { queryClient } from './query-client';
import { router } from './router';

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PermissionProvider>
          <RouterProvider router={router} />
          <Toaster />
        </PermissionProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
