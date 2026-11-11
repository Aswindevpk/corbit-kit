-- Copy, rename, fill in. Delete the comments you don't need.
-- Rules: platforms/supabase/docs/rpc-guide.md

create or replace function public.<verb>_<noun>(p_id uuid /*, … */)
returns jsonb
language plpgsql
security definer          -- writes only; reads use `security invoker` + `stable`
set search_path = ''      -- mandatory with security definer; qualify every name
as $$
declare
  v_row public.<table>;
begin
  -- 1. Permission (first, always)
  if not internal.has_permission('<module>.<action>', (select tenant_id from public.<table> where id = p_id)) then
    raise exception using errcode = 'P0001', message = 'PERMISSION_DENIED';
  end if;

  -- 2. Load + lock what you will change
  select * into v_row from public.<table> where id = p_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = '<ENTITY>_NOT_FOUND';
  end if;

  -- 3. Validate (one coded error per rule; hint = form field name)
  -- if … then raise exception using errcode = 'P0001', message = 'INVALID_<FIELD>', hint = '<field>'; end if;

  -- 4. Change
  -- update public.<table> set … where id = p_id returning * into v_row;

  -- 5. Side effects (delivered after commit)
  -- perform internal.enqueue('<topic>', jsonb_build_object(…), '<idempotency-key>');

  return to_jsonb(v_row);
end;
$$;

revoke execute on function public.<verb>_<noun>(uuid) from public, anon;
grant execute on function public.<verb>_<noun>(uuid) to authenticated;
