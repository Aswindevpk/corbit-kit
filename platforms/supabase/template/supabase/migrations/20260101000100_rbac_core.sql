-- =============================================================================
-- RBAC CORE  (see shared/rbac-model/spec.md)
-- One model for all tiers. Tiers are role seeds (platforms/supabase/rbac/seeds).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 0. Private schema for helpers.
-- Not listed in the API's exposed schemas, so it is unreachable over HTTP.
-- RLS policies run as the calling role, so `authenticated` needs USAGE here and
-- EXECUTE on the specific helpers that policies call.
-- -----------------------------------------------------------------------------
create schema if not exists internal;
grant usage on schema internal to authenticated, service_role;
alter default privileges in schema internal revoke execute on functions from public;

-- Generic updated_at trigger, reused by every table.
create or replace function internal.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Permission string format: module.action, either part may be '*'.
create or replace function internal.valid_permissions(p_permissions text[])
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(bool_and(p ~ '^([a-z][a-z0-9_]*|\*)\.([a-z][a-z0-9_]*|\*)$'), true)
  from unnest(p_permissions) as p;
$$;

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------
create table public.tenants (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique check (code ~ '^[A-Z0-9-]{2,20}$'),
  name        text not null check (char_length(name) between 2 and 120),
  is_archived boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger tenants_updated_at before update on public.tenants
  for each row execute function internal.set_updated_at();

create table public.profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  full_name         text not null,
  avatar_url        text,
  is_active         boolean not null default true,
  active_session_id uuid,
  created_at        timestamptz not null default now()
);

create table public.roles (
  id                   uuid primary key default gen_random_uuid(),
  key                  text not null unique check (key ~ '^[a-z][a-z0-9_]*$'),
  name                 text not null,
  permissions          text[] not null default '{}' check (internal.valid_permissions(permissions)),
  is_global_only       boolean not null default false,
  assignable_by_tenant boolean not null default false,
  created_at           timestamptz not null default now()
);

create table public.memberships (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role_id    uuid not null references public.roles(id) on delete restrict,
  scope      text not null check (scope in ('global', 'tenant')),
  -- Deleting a tenant deletes its memberships. It can never widen access,
  -- because scope is explicit and the check below forbids tenant scope without a tenant.
  tenant_id  uuid references public.tenants(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint memberships_scope_tenant check (
    (scope = 'global' and tenant_id is null) or (scope = 'tenant' and tenant_id is not null)
  ),
  constraint memberships_unique unique nulls not distinct (user_id, role_id, tenant_id)
);
create index memberships_user_idx on public.memberships (user_id);
create index memberships_tenant_idx on public.memberships (tenant_id);

-- -----------------------------------------------------------------------------
-- 2. Table privileges: users never write roles, scopes or permissions directly.
-- -----------------------------------------------------------------------------
revoke insert, update, delete on public.tenants, public.roles, public.memberships from anon, authenticated;
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;
revoke all on public.tenants, public.roles, public.memberships, public.profiles from anon;

-- -----------------------------------------------------------------------------
-- 3. Session lock
-- Flip single_session_enabled() to `select true` in a project migration to turn
-- on "new login signs out the old device". The client also calls
-- signOut({ scope: 'others' }) after login (src/config/app.config.ts).
-- -----------------------------------------------------------------------------
create or replace function internal.single_session_enabled()
returns boolean language sql immutable set search_path = '' as $$
  select false;
$$;

create or replace function internal.is_current_session()
returns boolean language sql stable security definer set search_path = '' as $$
  select not internal.single_session_enabled()
      or exists (
        select 1 from public.profiles p
        where p.id = (select auth.uid())
          and p.active_session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      );
$$;

-- -----------------------------------------------------------------------------
-- 4. Permission evaluation
-- -----------------------------------------------------------------------------
create or replace function internal.permission_matches(p_granted text[], p_required text)
returns boolean language sql immutable set search_path = '' as $$
  select p_required = any(p_granted)
      or '*.*' = any(p_granted)
      or (split_part(p_required, '.', 1) || '.*') = any(p_granted)
      or ('*.' || split_part(p_required, '.', 2)) = any(p_granted);
$$;

-- Does the current user hold p_permission for a resource in p_tenant_id?
-- p_tenant_id NULL = a resource that belongs to no tenant: only global grants count.
create or replace function internal.has_permission(p_permission text, p_tenant_id uuid default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select internal.is_current_session() and exists (
    select 1
    from public.memberships m
    join public.roles r     on r.id = m.role_id
    join public.profiles p  on p.id = m.user_id
    left join public.tenants t on t.id = m.tenant_id
    where m.user_id = (select auth.uid())
      and p.is_active
      and (
        m.scope = 'global'
        or (p_tenant_id is not null and m.tenant_id = p_tenant_id and not t.is_archived)
      )
      and internal.permission_matches(r.permissions, p_permission)
  );
$$;

-- Is the current user a member of this tenant at all (any role)?
create or replace function internal.is_tenant_member(p_tenant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select internal.is_current_session() and exists (
    select 1 from public.memberships m
    where m.user_id = (select auth.uid()) and m.tenant_id = p_tenant_id
  );
$$;

-- Can the current user see this profile? (self, or users.read where they're a member)
create or replace function internal.can_read_profile(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select p_profile_id = (select auth.uid())
      or internal.has_permission('users.read')
      or exists (
        select 1 from public.memberships m
        where m.user_id = p_profile_id
          and m.tenant_id is not null
          and internal.has_permission('users.read', m.tenant_id)
      );
$$;

grant execute on function
  internal.is_current_session(),
  internal.permission_matches(text[], text),
  internal.has_permission(text, uuid),
  internal.is_tenant_member(uuid),
  internal.can_read_profile(uuid)
to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Triggers on auth.*
-- -----------------------------------------------------------------------------
-- Profile on signup. Only display data comes from metadata; tenants and roles never do.
create or replace function internal.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'User'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function internal.handle_new_user();

-- Latest login becomes the active session (used only when single session is on).
create or replace function internal.handle_new_session()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.profiles set active_session_id = new.id where id = new.user_id;
  return new;
end;
$$;

create trigger on_auth_session_created
  after insert on auth.sessions
  for each row execute function internal.handle_new_session();

-- -----------------------------------------------------------------------------
-- 6. RLS
-- -----------------------------------------------------------------------------
alter table public.tenants     enable row level security;
alter table public.profiles    enable row level security;
alter table public.roles       enable row level security;
alter table public.memberships enable row level security;

create policy "members see their tenants" on public.tenants
  for select to authenticated
  using (internal.is_tenant_member(id) or internal.has_permission('users.read'));

create policy "read profiles in reach" on public.profiles
  for select to authenticated
  using (internal.can_read_profile(id));

create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "authenticated read roles" on public.roles
  for select to authenticated
  using (true);

create policy "read own or managed memberships" on public.memberships
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or internal.has_permission('users.read', tenant_id)
  );

-- -----------------------------------------------------------------------------
-- 7. RPCs
-- -----------------------------------------------------------------------------
-- The frontend PermissionSet (shared/rbac-model/spec.md).
create or replace function public.get_my_permissions()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'userId', (select auth.uid()),
    'grants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'scope', m.scope,
        'tenantId', m.tenant_id,
        'role', r.key,
        'permissions', to_jsonb(r.permissions)
      ))
      from public.memberships m
      join public.roles r on r.id = m.role_id
      where m.user_id = (select auth.uid())
    ), '[]'::jsonb)
  );
$$;

-- Grant a role. p_tenant_id NULL = global membership.
create or replace function public.assign_membership(p_user_id uuid, p_role_key text, p_tenant_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_role public.roles;
  v_id   uuid;
begin
  select * into v_role from public.roles where key = p_role_key;
  if not found then
    raise exception using errcode = 'P0001', message = 'ROLE_NOT_FOUND', hint = 'role';
  end if;

  -- With a NULL tenant this only passes for global managers.
  if not internal.has_permission('users.manage', p_tenant_id) then
    raise exception using errcode = 'P0001', message = 'PERMISSION_DENIED';
  end if;

  if v_role.is_global_only and p_tenant_id is not null then
    raise exception using errcode = 'P0001', message = 'ROLE_REQUIRES_GLOBAL_SCOPE', hint = 'role';
  end if;

  if p_tenant_id is not null
     and not v_role.assignable_by_tenant
     and not internal.has_permission('users.manage') then
    raise exception using errcode = 'P0001', message = 'PERMISSION_DENIED';
  end if;

  insert into public.memberships (user_id, role_id, scope, tenant_id, created_by)
  values (
    p_user_id, v_role.id,
    case when p_tenant_id is null then 'global' else 'tenant' end,
    p_tenant_id, (select auth.uid())
  )
  on conflict on constraint memberships_unique do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.memberships
    where user_id = p_user_id and role_id = v_role.id and tenant_id is not distinct from p_tenant_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.revoke_membership(p_membership_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_m    public.memberships;
  v_role public.roles;
begin
  select * into v_m from public.memberships where id = p_membership_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'NOT_FOUND';
  end if;
  if v_m.user_id = (select auth.uid()) then
    raise exception using errcode = 'P0001', message = 'SELF_REVOKE_NOT_ALLOWED';
  end if;

  select * into v_role from public.roles where id = v_m.role_id;
  if not internal.has_permission('users.manage', v_m.tenant_id)
     or (v_m.tenant_id is not null and not v_role.assignable_by_tenant
         and not internal.has_permission('users.manage')) then
    raise exception using errcode = 'P0001', message = 'PERMISSION_DENIED';
  end if;

  delete from public.memberships where id = p_membership_id;
end;
$$;

revoke execute on function
  public.get_my_permissions(),
  public.assign_membership(uuid, text, uuid),
  public.revoke_membership(uuid)
from public, anon;
grant execute on function
  public.get_my_permissions(),
  public.assign_membership(uuid, text, uuid),
  public.revoke_membership(uuid)
to authenticated;
