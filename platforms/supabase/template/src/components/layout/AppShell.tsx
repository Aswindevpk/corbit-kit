import { useState } from 'react';
import { Outlet } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/platform';
import { cn } from '@/lib/utils';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const queryClient = useQueryClient();
  const handleSignOut = async () => {
    await signOut();
    queryClient.clear(); // never show the next user cached data
  };

  return (
    <div className="flex min-h-svh">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-60 border-r transition-transform md:static md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
        onClick={() => setMobileOpen(false)}
      >
        <Sidebar />
      </aside>
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4 md:px-8">
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
            <Menu />
          </Button>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => void handleSignOut()}>
              <LogOut /> Sign out
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
