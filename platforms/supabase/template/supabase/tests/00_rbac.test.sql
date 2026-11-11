-- RBAC tests. Mirrors shared/rbac-model/personas.yaml.  Run: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

-- ---- fixtures (as postgres) -------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'manager@test.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'accountant@test.local'),
  ('00000000-0000-0000-0000-0000000000a4', 'teacher@test.local'),
  ('00000000-0000-0000-0000-0000000000a5', 'nobody@test.local');

insert into public.tenants (id, code, name) values
  ('00000000-0000-0000-0000-0000000000c1', 'T-CLT', 'Test Calicut'),
  ('00000000-0000-0000-0000-0000000000c2', 'T-KOC', 'Test Kochi');

insert into public.roles (id, key, name, permissions, is_global_only, assignable_by_tenant) values
  ('00000000-0000-0000-0000-0000000000b1', 't_super',   'Super',   '{*.*}', true, false),
  ('00000000-0000-0000-0000-0000000000b2', 't_manager', 'Manager', '{branches.read,branches.update,users.read,users.manage}', false, false),
  ('00000000-0000-0000-0000-0000000000b3', 't_account', 'Account', '{branches.read,fees.*}', false, true),
  ('00000000-0000-0000-0000-0000000000b4', 't_teacher', 'Teacher', '{attendance.create}', false, true);

insert into public.memberships (user_id, role_id, scope, tenant_id) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'global', null),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2', 'tenant', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b3', 'tenant', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000b4', 'tenant', '00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000b4', 'tenant', '00000000-0000-0000-0000-0000000000c2');

select is((select count(*)::int from public.profiles where id::text like '00000000-0000-0000-0000-0000000000a%'),
          5, 'profiles are created on signup');

select throws_ok(
  $$ insert into public.memberships (user_id, role_id, scope, tenant_id)
     values ('00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000b1', 'tenant', null) $$,
  '23514', null, 'tenant scope without a tenant is rejected');

-- ---- head-office admin ------------------------------------------------------
set local role authenticated;
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select ok(internal.has_permission('branches.create'), 'admin: global create');
select ok(internal.has_permission('fees.delete', '00000000-0000-0000-0000-0000000000c2'), 'admin: any tenant');

-- ---- accountant at CLT ------------------------------------------------------
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}';
select ok(internal.has_permission('fees.read', '00000000-0000-0000-0000-0000000000c1'), 'accountant: fees at own branch');
select ok(not internal.has_permission('fees.read', '00000000-0000-0000-0000-0000000000c2'), 'accountant: not at other branch');
select ok(not internal.has_permission('crm.read', '00000000-0000-0000-0000-0000000000c1'), 'accountant: no crm');
select is((select count(*)::int from public.tenants where code like 'T-%'), 1, 'accountant sees only own test tenant');
select throws_ok(
  $$ update public.profiles set is_active = false where id = '00000000-0000-0000-0000-0000000000a3' $$,
  '42501', null, 'users cannot write privileged profile columns');
select throws_ok(
  $$ insert into public.memberships (user_id, role_id, scope) values
     ('00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000b1', 'global') $$,
  '42501', null, 'users cannot insert memberships directly');

-- ---- teacher at two campuses ------------------------------------------------
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-0000000000a4","role":"authenticated"}';
select ok(internal.has_permission('attendance.create', '00000000-0000-0000-0000-0000000000c2'), 'teacher: second campus');

-- ---- branch manager cannot escalate ----------------------------------------
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select throws_ok(
  $$ select public.assign_membership('00000000-0000-0000-0000-0000000000a5', 't_super', null) $$,
  'P0001', 'PERMISSION_DENIED', 'manager cannot grant global roles');

-- ---- deleting a tenant never widens access ---------------------------------
reset role;
delete from public.tenants where id = '00000000-0000-0000-0000-0000000000c2';
select is((select count(*)::int from public.memberships
            where user_id = '00000000-0000-0000-0000-0000000000a4' and scope = 'global'),
          0, 'deleting a tenant grants nothing globally');

select * from finish();
rollback;
