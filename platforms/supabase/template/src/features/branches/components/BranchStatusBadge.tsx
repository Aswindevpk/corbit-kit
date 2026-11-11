import { Badge } from '@/components/ui/badge';

export function BranchStatusBadge({ isArchived }: { isArchived: boolean }) {
  return isArchived ? <Badge variant="secondary">Archived</Badge> : <Badge variant="success">Active</Badge>;
}
