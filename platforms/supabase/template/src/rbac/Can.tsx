import type { ReactNode } from 'react';
import type { PermissionScope } from './match';
import { usePermission } from './hooks';

type CanProps = { permission: string; scope?: PermissionScope; fallback?: ReactNode; children: ReactNode };

/** Hides UI the user can't use. Not a security boundary: the backend enforces. */
export function Can({ permission, scope, fallback = null, children }: CanProps) {
  return usePermission(permission, scope) ? <>{children}</> : <>{fallback}</>;
}
