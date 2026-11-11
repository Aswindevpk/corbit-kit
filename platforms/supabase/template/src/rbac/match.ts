import type { PermissionSet } from '@/lib/contracts';

// Mirrors internal.permission_matches / internal.has_permission in the database.
// The UI uses this only to hide things. The backend always enforces.

export function permissionMatches(granted: readonly string[], required: string): boolean {
  const [module, action] = required.split('.');
  return (
    granted.includes(required) ||
    granted.includes('*.*') ||
    granted.includes(`${module}.*`) ||
    granted.includes(`*.${action}`)
  );
}

export type PermissionScope =
  | { tenantId: string }        // resource in this tenant
  | { global: true }            // resource with no tenant: global grants only
  | { anywhere: true };         // "can they do this somewhere?": for nav and buttons

export function can(set: PermissionSet | undefined, required: string, scope: PermissionScope = { anywhere: true }): boolean {
  if (!set) return false;
  return set.grants.some((g) => {
    if (!permissionMatches(g.permissions, required)) return false;
    if ('anywhere' in scope) return true;
    if (g.scope === 'global') return true;
    return 'tenantId' in scope && g.tenantId === scope.tenantId;
  });
}
