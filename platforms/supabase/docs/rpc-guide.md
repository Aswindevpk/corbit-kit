# Writing RPCs

Reference: `template/supabase/migrations/20260101000300_branches.sql`.

## Read vs write

| | Reads | Writes |
|---|---|---|
| Security | `security invoker` | `security definer` |
| Who decides access | RLS policies | Explicit `internal.has_permission()` check, first line |
| Volatility | `stable` | default (volatile) |
| `search_path` | `''` | `''` (mandatory for definer) |

Definer functions bypass RLS, so the permission check is the only guard. Forgetting it
is the most common serious bug; reviews should look for it first.

## Shape of a write RPC

```sql
create or replace function public.do_thing(p_id uuid, p_value text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_row public.things;
begin
  -- 1. permission
  if not internal.has_permission('things.update', (select tenant_id from public.things where id = p_id)) then
    raise exception using errcode = 'P0001', message = 'PERMISSION_DENIED';
  end if;
  -- 2. validation, each failure a coded error with the form field
  if char_length(trim(p_value)) < 2 then
    raise exception using errcode = 'P0001', message = 'INVALID_THING_VALUE', hint = 'value';
  end if;
  -- 3. change (lock rows you read-then-write: `for update`)
  update public.things set value = trim(p_value) where id = p_id returning * into v_row;
  if not found then
    raise exception using errcode = 'P0001', message = 'THING_NOT_FOUND';
  end if;
  -- 4. side effects, delivered after commit by the outbox worker
  perform internal.enqueue('push.send', jsonb_build_object('thingId', p_id), 'thing-updated:' || p_id);
  return to_jsonb(v_row);
end;
$$;
```

A copy-ready version is in `patterns/rpc-template.sql`.

## Error contract

`raise exception using errcode = 'P0001', message = 'CODE', hint = 'formField';`

- `src/platform/errors.ts` turns this into `AppError('CODE', { field: 'formField' })`.
- Forms put the message under the field named by `hint`, so `hint` must equal the
  **form field name**, not the column name.
- `42501` (privilege) becomes `PERMISSION_DENIED`; unhandled `23505` becomes `DUPLICATE`.
  Prefer catching `unique_violation` yourself and raising a domain code.

## Lists

Return `jsonb { rows, total }`. Accept `p_search, p_limit (1–100), p_offset, p_sort, p_dir`.
Whitelist sort columns with `case`, build the `order by` with `format('%s')`, and pass
every user value through `execute … using`. Never concatenate user input into SQL.

## Grants

```sql
revoke execute on function public.do_thing(uuid, text) from public, anon;
grant execute on function public.do_thing(uuid, text) to authenticated;
```

## Tests first

Each acceptance criterion in the Logic Doc becomes one pgTAP assertion, written before
the function. See `template/supabase/tests/10_branches.test.sql`.
