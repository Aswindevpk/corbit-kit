-- Tier 4: tenants are branches; department roles get whole modules (module.*).
insert into public.roles (key, name, permissions, is_global_only, assignable_by_tenant) values
  ('super_admin',    'Super admin',    '{*.*}', true, false),
  ('branch_manager', 'Branch manager', '{branches.read,branches.update,users.read,users.manage,fees.*,crm.*,attendance.*}', false, false),
  ('accountant',     'Accountant',     '{branches.read,fees.*}', false, true),
  ('counselor',      'Counselor',      '{branches.read,crm.*}', false, true),
  ('teacher',        'Teacher',        '{branches.read,attendance.read,attendance.create}', false, true)
on conflict (key) do nothing;
