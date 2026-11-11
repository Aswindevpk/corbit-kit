import { createBrowserRouter } from 'react-router';
import { AppShell } from '@/components/layout/AppShell';
import { ErrorState } from '@/components/patterns';
import { RequirePermission } from '@/rbac';
import { LoginPage } from '@/features/auth';
import { BranchesPage } from '@/features/branches';
import { DashboardPage } from '@/features/dashboard';
import { RequireAuth } from './guards';

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      {
        path: 'branches',
        element: (
          <RequirePermission permission="branches.read">
            <BranchesPage />
          </RequirePermission>
        ),
      },
      { path: '*', element: <ErrorState title="Page not found" description="Check the address, or use the menu." /> },
    ],
  },
]);
