-- Tier 3: tenants are workspaces. Every membership is tenant-scoped.
-- Owners can invite (assignable_by_tenant) everyone except other owners;
-- to transfer ownership, write a dedicated RPC.
insert into public.roles (key, name, permissions, is_global_only, assignable_by_tenant) values
  ('platform_admin', 'Platform admin', '{*.*}', true, false),
  ('owner',  'Owner',  '{*.*}', false, false),
  ('admin',  'Admin',  '{*.read,*.create,*.update,*.delete,users.read,users.manage}', false, true),
  ('member', 'Member', '{*.read,*.create,*.update}', false, true),
  ('guest',  'Guest',  '{*.read}', false, true)
on conflict (key) do nothing;
