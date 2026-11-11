import { z } from 'zod';
import type { PermissionSet } from '@/lib/contracts';
import { supabase } from './client';
import { unwrap } from './errors';

const permissionSetSchema = z.object({
  userId: z.string().nullable(),
  grants: z.array(
    z.object({
      scope: z.enum(['global', 'tenant']),
      tenantId: z.string().nullable(),
      role: z.string(),
      permissions: z.array(z.string()),
    }),
  ),
});

export async function fetchMyPermissions(): Promise<PermissionSet> {
  const data = await unwrap(supabase.rpc('get_my_permissions'));
  return permissionSetSchema.parse(data);
}
