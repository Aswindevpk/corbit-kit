-- Tier 1: admin vs everyone. Regular users have no membership; use ownership policies
-- (user_id = (select auth.uid())) for their own data.
insert into public.roles (key, name, permissions, is_global_only) values
  ('admin', 'Administrator', '{*.*}', true)
on conflict (key) do nothing;
