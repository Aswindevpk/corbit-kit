import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { PermissionSet } from '@/lib/contracts';
import { fetchMyPermissions, useAuth } from '@/platform';

type PermissionContextValue = { permissions: PermissionSet | undefined; isLoading: boolean };

const PermissionContext = createContext<PermissionContextValue>({ permissions: undefined, isLoading: true });

export const permissionKeys = { mine: (userId: string | undefined) => ['rbac', 'mine', userId] as const };

export function PermissionProvider({ children }: { children: ReactNode }) {
  const { user, status } = useAuth();
  const query = useQuery({
    queryKey: permissionKeys.mine(user?.id),
    queryFn: fetchMyPermissions,
    enabled: status === 'authenticated',
    staleTime: 5 * 60_000,
  });

  return (
    <PermissionContext.Provider
      value={{ permissions: query.data, isLoading: status === 'loading' || (status === 'authenticated' && query.isLoading) }}
    >
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissionSet(): PermissionContextValue {
  return useContext(PermissionContext);
}
