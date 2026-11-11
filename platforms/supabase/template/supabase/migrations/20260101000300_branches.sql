-- =============================================================================
-- FEATURE: Branches (golden reference feature)
-- Branches are the UI/domain name for public.tenants in this template.
-- Logic doc: docs/02-organisation/FID02.1-branches.md
--
-- Pattern every feature follows:
--   * Reads:  SECURITY INVOKER RPC, so RLS decides what rows exist for the caller.
--   * Writes: SECURITY DEFINER RPC that (1) checks the permission explicitly,
--             (2) validates input and raises coded errors with a form `field` hint,
--             (3) performs the change atomically, (4) enqueues side effects.
--   * Errors: errcode P0001, message = ERROR_CODE, hint = form field name.
-- =============================================================================

create policy "branches.read can see branches" on public.tenants
  for select to authenticated
  using (internal.has_permission('branches.read', id));

-- ---- list ------------------------------------------------------------------
create or replace function public.list_branches(
  p_search           text    default null,
  p_include_archived boolean default false,
  p_limit            int     default 20,
  p_offset           int     default 0,
  p_sort             text    default 'name',
  p_dir              text    default 'asc'
)
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
declare
  v_order  text;
  v_dir    text;
  v_result jsonb;
begin
  if p_limit not between 1 and 100 or p_offset < 0 then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED', hint = 'pageSize';
  end if;

  v_order := case p_sort
    when 'name'       then 't.name'
    when 'code'       then 't.code'
    when 'created_at' then 't.created_at'
  end;
  v_dir := case lower(p_dir) when 'asc' then 'asc' when 'desc' then 'desc' end;
  if v_order is null or v_dir is null then
    raise exception using errcode = 'P0001', message = 'VALIDATION_FAILED', hint = 'sort';
  end if;

  -- v_order and v_dir come from the whitelists above; user input is only passed via USING.
  execute format($q$
    with page as (
      select t.id, t.code, t.name, t.is_archived, t.created_at, t.updated_at,
             count(*) over () as total_count,
             row_number() over (order by %1$s %2$s, t.id) as ord
        from public.tenants t
       where ($1 or not t.is_archived)
         and ($2 is null or t.name ilike '%%' || $2 || '%%' or t.code ilike '%%' || $2 || '%%')
       order by ord
       limit $3 offset $4
    )
    select jsonb_build_object(
      'rows',  coalesce(jsonb_agg(to_jsonb(page) - 'total_count' - 'ord' order by ord), '[]'::jsonb),
      'total', coalesce(max(total_count), 0)
    ) from page
  $q$, v_order, v_dir)
  into v_result
  using p_include_archived, nullif(trim(p_search), ''), p_limit, p_offset;

  return v_result;
end;
$$;

-- ---- create ----------------------------------------------------------------
-- Rule: only global users with branches.create can open a branch.
create or replace function public.create_branch(p_code text, p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_code text := upper(trim(p_code));
  v_name text := trim(p_name);
  v_row  public.tenants;
begin
  if not internal.has_permission('branches.create') then
    raise exception using errcode = 'P0001', message = 'PERMISSION_DENIED';
  end if;
  if v_code is null or v_code !~ '^[A-Z0-9-]{2,20}$' then
    raise exception using errcode = 'P0001', message = 'INVALID_BRANCH_CODE', hint = 'code';
  end if;
  if v_name is null or char_length(v_name) not between 2 and 120 then
    raise exception using errcode = 'P0001', message = 'INVALID_BRANCH_NAME', hint = 'name';
  end if;

  begin
    insert into public.tenants (code, name) values (v_code, v_name) returning * into v_row;
  exception when unique_violation then
    raise exception using errcode = 'P0001', message = 'BRANCH_CODE_TAKEN', hint = 'code';
  end;

  -- Example side effect, delivered later by the outbox worker:
  perform internal.enqueue('debug.log', jsonb_build_object('event', 'branch.created', 'id', v_row.id));

  return to_jsonb(v_row);
end;
$$;

-- ---- update ----------------------------------------------------------------
-- Rule: the code is permanent; only the name changes. Archived branches are read-only.
create or replace function public.update_branch(p_id uuid, p_name text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_name text := trim(p_name);
  v_row  public.tenants;
begin
  select * into v_row from public.tenants where id = p_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'BRANCH_NOT_FOUND';
  end if;
  if not internal.has_permission('branches.update', p_id) then
    raise exception using errcode = 'P0001', message = 'PERMISSION_DENIED';
  end if;
  if v_row.is_archived then
    raise exception using errcode = 'P0001', message = 'BRANCH_ARCHIVED';
  end if;
  if v_name is null or char_length(v_name) not between 2 and 120 then
    raise exception using errcode = 'P0001', message = 'INVALID_BRANCH_NAME', hint = 'name';
  end if;

  update public.tenants set name = v_name where id = p_id returning * into v_row;
  return to_jsonb(v_row);
end;
$$;

-- ---- archive / restore -------------------------------------------------------
-- Rule: only global users with branches.archive. Archiving suspends every
-- tenant-scoped membership at that branch (see internal.has_permission).
create or replace function public.set_branch_archived(p_id uuid, p_archived boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_row public.tenants;
begin
  if not internal.has_permission('branches.archive') then
    raise exception using errcode = 'P0001', message = 'PERMISSION_DENIED';
  end if;
  update public.tenants set is_archived = p_archived where id = p_id returning * into v_row;
  if not found then
    raise exception using errcode = 'P0001', message = 'BRANCH_NOT_FOUND';
  end if;
  return to_jsonb(v_row);
end;
$$;

revoke execute on function
  public.list_branches(text, boolean, int, int, text, text),
  public.create_branch(text, text),
  public.update_branch(uuid, text),
  public.set_branch_archived(uuid, boolean)
from public, anon;
grant execute on function
  public.list_branches(text, boolean, int, int, text, text),
  public.create_branch(text, text),
  public.update_branch(uuid, text),
  public.set_branch_archived(uuid, boolean)
to authenticated;
