# Migrations and types

```bash
supabase migration new add_invoices   # creates supabase/migrations/<timestamp>_add_invoices.sql
npm run db:reset                      # re-apply everything locally + seed + regenerate types
npm run test:db                       # pgTAP
supabase db push                      # apply to the linked remote project (CI or a lead only)
```

Rules:

- One concern per migration; name it after the feature (`..._invoices.sql`).
- Never edit a migration that has run on a shared database. Write a new one.
- Never change schema in the Studio UI. If you must experiment there, capture it with
  `supabase db diff -f <name>` and review the result.
- `src/types/database.types.ts` is generated. Commit it; never hand-edit it.
- After regenerating types, `npm run typecheck` shows every `api/` call that broke.
  Only `api/` files should need changes. If a component breaks, it was importing
  generated types, which the lint rules forbid.

Remote environments: keep `staging` and `production` as separate Supabase projects.
Deploy migrations from CI in order: staging, tests, then production.
