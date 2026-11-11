-- Branches feature tests. One assertion per acceptance criterion.  Run: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@test.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'manager@test.local'),
  ('00000000-0000-0000-0000-0000000000a5', 'nobody@test.local');
insert into public.tenants (id, code, name) values
  ('00000000-0000-0000-0000-0000000000c1', 'T-CLT', 'Test Calicut'),
  ('00000000-0000-0000-0000-0000000000c2', 'T-KOC', 'Test Kochi');
insert into public.roles (id, key, name, permissions, is_global_only) values
  ('00000000-0000-0000-0000-0000000000b1', 't_super',   'Super',   '{*.*}', true),
  ('00000000-0000-0000-0000-0000000000b2', 't_manager', 'Manager', '{branches.read,branches.update}', false);
insert into public.memberships (user_id, role_id, scope, tenant_id) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000b1', 'global', null),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000b2', 'tenant', '00000000-0000-0000-0000-0000000000c1');

set local role authenticated;

-- AC: users without branches.read see nothing
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-0000000000a5","role":"authenticated"}';
select is((public.list_branches() ->> 'total')::int, 0, 'no access → empty list');

-- AC: admin creates a branch; code is normalised to upper case
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}';
select is(public.create_branch(' t-tvm ', 'Trivandrum') ->> 'code', 'T-TVM', 'create normalises code');
select throws_ok($$ select public.create_branch('T-TVM', 'Again') $$, 'P0001', 'BRANCH_CODE_TAKEN', 'duplicate code');
select throws_ok($$ select public.create_branch('x', 'Bad code') $$, 'P0001', 'INVALID_BRANCH_CODE', 'invalid code');

-- AC: archived branches are hidden by default
select lives_ok($$ select public.set_branch_archived('00000000-0000-0000-0000-0000000000c2', true) $$, 'admin archives a branch');
select is((public.list_branches(p_search => 'T-KOC') ->> 'total')::int, 0, 'archived hidden by default');
select is((public.list_branches(p_search => 'T-KOC', p_include_archived => true) ->> 'total')::int, 1, 'archived shown on request');

-- AC: branch manager edits own branch only, cannot create
set local "request.jwt.claims" to '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}';
select is(public.update_branch('00000000-0000-0000-0000-0000000000c1', 'Calicut Renamed') ->> 'name',
          'Calicut Renamed', 'manager updates own branch');
select throws_ok($$ select public.update_branch('00000000-0000-0000-0000-0000000000c2', 'Nope') $$,
                 'P0001', 'PERMISSION_DENIED', 'manager cannot update other branch');
select throws_ok($$ select public.create_branch('T-NEW', 'New') $$, 'P0001', 'PERMISSION_DENIED', 'manager cannot create');

select * from finish();
rollback;
