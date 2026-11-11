import { NavLink } from 'react-router';
import { navItems } from '@/config/nav.config';
import { appConfig } from '@/config/app.config';
import { useCan } from '@/rbac';
import { cn } from '@/lib/utils';

export function Sidebar() {
  const can = useCan();
  const items = navItems.filter((item) => !item.permission || can(item.permission));

  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-1 bg-sidebar p-3 text-sidebar-foreground">
      <div className="px-2 pt-1 pb-5 text-base font-semibold">{appConfig.name}</div>
      {items.map(({ label, path, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          end={path === '/'}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-sidebar-active',
              'focus-visible:outline-2 focus-visible:outline-ring',
              isActive && 'bg-sidebar-active font-medium',
            )
          }
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
