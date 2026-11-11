# Backend rules (Supabase / Postgres)

Reference: `migrations/20260101000300_branches.sql` and `tests/10_branches.test.sql`.
Full guides: `platforms/supabase/docs/` in the Corbit kit.

## Migrations
- Every change is a migration file (`supabase migration new <name>`). Never edit in the dashboard.
- Never edit a migration that has run anywhere shared. Add a new one.
- After each migration: `npm run db:reset` (resets local DB, regenerates types).

## Tables
- `id uuid primary key default gen_random_uuid()`, `created_at`, `updated_at` + `internal.set_updated_at` trigger.
- Constraints for every invariant the database can express (check, unique, exclusion, FK).
- `alter table … enable row level security;` in the same migration that creates the table.
- Tenant-owned tables have `tenant_id uuid not null references public.tenants(id)`.
- Revoke direct writes when writes must go through RPCs:
  `revoke insert, update, delete on public.x from anon, authenticated;`

## RLS
- Policies call `internal.has_permission('module.action', tenant_id)`.
  Pass NULL for resources that belong to no tenant (only global grants match).
- Use `(select auth.uid())`, not bare `auth.uid()`, so it's evaluated once per query.
- A policy must never query its own table (infinite recursion). Use a SECURITY DEFINER helper in `internal`.
- Own-data access ("a student sees their own rows") is `user_id = (select auth.uid())`, separate from RBAC.

## RPCs
- Reads: `security invoker`, `stable`. RLS decides visibility.
- Writes: `security definer`, `set search_path = ''`, fully qualified names (`public.x`, `internal.y`).
  First line: explicit permission check. Then validate. Then change. Then enqueue side effects.
- Errors: `raise exception using errcode = 'P0001', message = 'ERROR_CODE', hint = 'formField';`
  Codes come from the Logic Doc and `shared/standards/error-codes.md`.
- Catch `unique_violation` and re-raise as a domain code with a field hint.
- Lists return `jsonb { rows, total }`, accept `p_limit` (1–100) and `p_offset`,
  and whitelist sort columns. Dynamic SQL only with `format('%s')` on whitelisted values
  and `USING` for user input.
- Grants: `revoke execute … from public, anon; grant execute … to authenticated;`
- Never call external HTTP from an RPC. Use `perform internal.enqueue('topic', payload, idempotency_key);`

## Tests (pgTAP, `npm run test:db`)
- One assertion per acceptance criterion. Write tests before the RPC.
- Simulate users: `set local role authenticated; set local "request.jwt.claims" to '{"sub":"<uuid>","role":"authenticated"}';`
- Cover every persona in `docs/00-foundation/rbac.md` that should be blocked.

## Edge Functions
- Only for: webhooks (verify signature first), outbox handlers, and calls that need secrets.
- Handlers must be idempotent.
- Secrets via `supabase secrets set`, never in code.
