import { useCallback } from 'react';
import { can, type PermissionScope } from './match';
import { usePermissionSet } from './PermissionProvider';

/** usePermission('fees.read', { tenantId }) → boolean */
export function usePermission(required: string, scope?: PermissionScope): boolean {
  const { permissions } = usePermissionSet();
  return can(permissions, required, scope);
}

/** Returns a checker, for lists where each row needs its own check. */
export function useCan(): (required: string, scope?: PermissionScope) => boolean {
  const { permissions } = usePermissionSet();
  return useCallback((required, scope) => can(permissions, required, scope), [permissions]);
}
