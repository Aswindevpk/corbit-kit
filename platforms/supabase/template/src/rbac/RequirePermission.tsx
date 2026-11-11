import type { ReactNode } from 'react';
import { ErrorState } from '@/components/patterns/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { usePermissionSet } from './PermissionProvider';
import { can, type PermissionScope } from './match';

type Props = { permission: string; scope?: PermissionScope; children: ReactNode };

/** Route guard. Renders UI-STATE-BLOCKED when the user lacks the permission. */
export function RequirePermission({ permission, scope, children }: Props) {
  const { permissions, isLoading } = usePermissionSet();
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (!can(permissions, permission, scope)) {
    return (
      <ErrorState
        title="You don't have access to this page"
        description="Ask an administrator to give your role access if you need it."
      />
    );
  }
  return <>{children}</>;
}
