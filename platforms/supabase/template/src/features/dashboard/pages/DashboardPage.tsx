import { PageHeader } from '@/components/patterns';
import { Card, CardDescription, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/platform';
import { usePermissionSet } from '@/rbac';

export function DashboardPage() {
  const { user } = useAuth();
  const { permissions } = usePermissionSet();
  const roles = permissions?.grants.map((g) => g.role) ?? [];

  return (
    <>
      <PageHeader title="Dashboard" description={`Signed in as ${user?.email ?? ''}`} />
      <Card className="max-w-lg">
        <CardTitle>Your access</CardTitle>
        <CardDescription>
          {roles.length
            ? `Roles: ${[...new Set(roles)].join(', ')}`
            : "You don't have a role yet. Ask an administrator to give you access."}
        </CardDescription>
      </Card>
    </>
  );
}
