# RLS guide

## The standard policy

```sql
alter table public.invoices enable row level security;

create policy "invoices: read" on public.invoices
  for select to authenticated
  using (internal.has_permission('invoices.read', tenant_id));
```

If writes go through RPCs (the default), revoke direct writes instead of writing
insert/update/delete policies:

```sql
revoke insert, update, delete on public.invoices from anon, authenticated;
```

## Own data

A student reading their own records is ownership, not RBAC:

```sql
create policy "invoices: own" on public.invoices
  for select to authenticated
  using (student_user_id = (select auth.uid()));
```

Multiple permissive policies are OR-ed, so staff and owners both work.

## Mistakes that break things

| Mistake | What happens | Fix |
|---|---|---|
| Policy queries its own table | `infinite recursion detected in policy` | Move the lookup into a `security definer` function in `internal` |
| Helper schema not granted | `permission denied for schema internal` in every query | `grant usage on schema internal to authenticated` + `grant execute` on the helper |
| Bare `auth.uid()` in a policy | Re-evaluated per row; slow on big tables | `(select auth.uid())` |
| No index on columns used by policies | Sequential scans | Index `tenant_id`, `user_id` |
| `update` policy without `with check` on a table users can write | Users move rows to another tenant | Add `with check`, or revoke writes and use RPCs |
| NULL meaning "global" | Deleting a parent row promotes users | Explicit `scope` column (see RBAC core) |
| Trusting `raw_user_meta_data` | Users choose their own tenant or role at signup | Only display fields come from metadata |
| Long-lived signed Storage URLs | Access survives revocation (e.g. fee lockout) | Expiry in minutes |

## Storage

Storage objects use RLS on `storage.objects`. Put the tenant in the path
(`<tenant_id>/<file>`) and check it:

```sql
create policy "docs: read" on storage.objects for select to authenticated
  using (bucket_id = 'documents'
         and internal.has_permission('documents.read', ((storage.foldername(name))[1])::uuid));
```
