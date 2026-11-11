import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useCan } from '@/rbac';
import type { RowAction } from './types';

type Props<T> = { row: T; actions: RowAction<T>[]; label: string };

export function RowActionsMenu<T>({ row, actions, label }: Props<T>) {
  const can = useCan();
  const visible = actions.filter((a) => {
    if (a.hidden?.(row)) return false;
    if (!a.permission) return true;
    const { permission, scope } = a.permission(row);
    return can(permission, scope);
  });
  if (visible.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={`Actions for ${label}`}>
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {visible.map((a) => (
          <DropdownMenuItem key={a.label} variant={a.destructive ? 'destructive' : 'default'} onSelect={() => a.onSelect(row)}>
            {a.icon}
            {a.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
