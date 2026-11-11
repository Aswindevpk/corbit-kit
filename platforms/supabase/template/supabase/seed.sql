-- Local development seed. Runs on `supabase db reset`.
-- Roles: Tier 4 (modular) seed, copied from platforms/supabase/rbac/seeds/tier4-modular.sql.
-- Swap this block for the tier chosen in docs/00-foundation/rbac.md.

insert into public.roles (key, name, permissions, is_global_only, assignable_by_tenant) values
  ('super_admin',    'Super admin',    '{*.*}', true, false),
  ('branch_manager', 'Branch manager', '{branches.read,branches.update,users.read,users.manage,fees.*,crm.*,attendance.*}', false, false),
  ('accountant',     'Accountant',     '{branches.read,fees.*}', false, true),
  ('counselor',      'Counselor',      '{branches.read,crm.read,crm.create,crm.update}', false, true),
  ('teacher',        'Teacher',        '{branches.read,attendance.read,attendance.create}', false, true)
on conflict (key) do nothing;

insert into public.tenants (code, name) values
  ('CLT', 'Calicut Main Campus'),
  ('KOC', 'Kochi Campus')
on conflict (code) do nothing;

-- First super admin: sign up in the app, then run in the SQL editor:
--   insert into public.memberships (user_id, role_id, scope)
--   select '<YOUR_USER_UUID>', id, 'global' from public.roles where key = 'super_admin';
