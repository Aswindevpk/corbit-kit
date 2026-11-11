-- Tier 2: single organisation, ranked roles. All memberships are global.
-- "Editors edit only their own records" is an ownership condition in the policy:
--   using (internal.has_permission('docs.update') and (created_by = (select auth.uid())
--          or internal.has_permission('docs.manage')))
insert into public.roles (key, name, permissions, is_global_only) values
  ('super_admin', 'Super admin', '{*.*}', true),
  ('manager',     'Manager',     '{*.read,*.create,*.update,*.delete,*.manage}', true),
  ('editor',      'Editor',      '{*.read,*.create,*.update}', true),
  ('viewer',      'Viewer',      '{*.read}', true)
on conflict (key) do nothing;
