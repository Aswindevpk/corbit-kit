# AGENTS.md: rules for AI agents (and humans) working in this project

Platform: **Supabase** (Postgres, RLS, RPCs, Edge Functions) + React + TypeScript.
Read this file fully before writing code. Backend rules: `supabase/AGENTS.md`.

This file is **how to write code**. `AGENT.md` (singular, in this same root) is
**how to use `fidtrack`/`cortest`** — which FID to build next, how to mark it
done, how its tests are tracked. Read both; follow `AGENT.md`'s command sequence
and this file's architecture for every command it tells you to run.

---

## Part 1: Architecture (identical on every Corbit platform)

### Layers

```
@/components/ui        shadcn primitives. Never restyle; theme via src/styles/theme.css.
@/components/patterns  DataTable, FormModal, ConfirmDialog, TextField, PageHeader,
                       EmptyState, ErrorState. Use these before building anything.
@/components/layout    AppShell, Sidebar.
@/rbac                 usePermission, useCan, <Can>, <RequirePermission>.
@/lib                  contracts (ListResult, AppError, PermissionSet), utils, hooks.
@/platform             THE ONLY app-level platform code (client, auth, errors, storage).
@/features/<name>      Everything for one feature (anatomy below).
```

### Feature anatomy

```
features/<name>/
├── types/        domain types, camelCase, platform-neutral
├── schemas/      Zod schemas for forms
├── messages.ts   user-facing text for this feature's error codes
├── components/   dumb: props in, callbacks out
├── forms/        RHF + Zod; emit onSubmit(values); show AppError on the matching field
├── views/        compose components + forms; dumb; may hold UI-only state (which dialog is open)
├── pages/        wiring: api hooks → view; list params; toasts
├── api/          keys, queries, mutations, mappers (+ mapper tests). Only place that calls Supabase.
└── index.ts      public exports
```

**The reference implementation is `src/features/branches/`.** When building a new feature,
open the matching branches file and follow its structure exactly.

### Hard rules

1. Components, forms and views never import `api/`, `@/platform`, `@supabase/*`, or
   `@/types/database.types`. They only see domain types from `types/`.
2. Pages never import `@/platform/client`. They call `api/` hooks.
3. `api/` returns domain types (via mappers that validate with Zod), `ListResult<T>` for
   lists, and throws only `AppError`.
4. Features import other features only via `@/features/<name>`.
5. No raw `<button> <input> <select> <textarea> <table>` in features. `<form>` only in `forms/`.
6. No business rules in the UI. If you are about to compute a status, a total that is
   saved, an eligibility or a permission outcome in TypeScript, it belongs in the backend.
   Display-only derivations (formatting, a running total shown while typing) are fine.
7. Every destructive action goes through `ConfirmDialog` with a specific confirm label.
8. Every list uses `DataTable`; every list RPC is server-paginated.
9. Permission checks in the UI (`<Can>`, `useCan`, `RequirePermission`, nav `permission`)
   only hide things. The backend always enforces.
10. Never invent fields. Use only fields in `docs/00-foundation/entity-field-register.md`.
    If one is missing, stop and say so.
11. Copy: sentence case, plain verbs, buttons name the action ("Add branch", "Archive branch"),
    toasts echo it ("Branch archived"). Errors say what happened and what to do.

### Order of work for a feature (one step per session)

1. Backend: tests from the Logic Doc's acceptance criteria → migration until green → `npm run db:types`.
2. `api/` + `types/` + mapper tests.
3. `components/`, `forms/`, `views/`.
4. `pages/` + route in `src/app/router.tsx` + nav entry in `src/config/nav.config.ts`.
5. `npm run check` and `npm run test:db` must pass.

Splitting files: split by responsibility, never to satisfy a line count.

---

## Part 2: Supabase specifics

- Business logic lives in Postgres RPCs. See `supabase/AGENTS.md`.
- Call RPCs as `unwrap(supabase.rpc('fn_name', args))` inside `api/` only.
- RPC errors arrive as `AppError(code, { field })`; `field` is the form field name.
- After any migration: `npm run db:types`. Never hand-edit `src/types/database.types.ts`.
- Map snake_case rows to camelCase domain types in `api/<f>.mappers.ts`.
- Lists: RPC takes `p_search, p_limit, p_offset, p_sort, p_dir` and returns
  `{ rows, total }` as jsonb.
- Realtime subscriptions (if any) live in `api/` hooks and update the React Query cache.
