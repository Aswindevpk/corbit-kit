import { Building2, LayoutDashboard, type LucideIcon } from 'lucide-react';

export type NavItem = {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Shown only if the user holds this permission in any scope. Omit for everyone. */
  permission?: string;
};

export const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  { label: 'Branches', path: '/branches', icon: Building2, permission: 'branches.read' },
];
