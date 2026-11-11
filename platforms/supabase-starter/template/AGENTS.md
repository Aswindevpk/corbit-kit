# AGENTS.md: rules for AI agents (and humans) working in this project

Platform: **Supabase** (Auth only, no schema yet) + React + TypeScript.
This is the **blank starter**: UI, theme, login and a dummy-data dashboard, no
SQL. Read this file fully before writing code.

This file is **how to write code**. `AGENT.md` (singular, created once
`fidtrack init` has run) is **how to use `fidtrack`/`cortest`** — which FID to
build next, how to mark it done, how its tests are tracked. Read both.

## Architecture

```
@/components/ui        shadcn primitives (base-ui + phosphor-icons). Never restyle;
                       theme via the `:root` / `.dark` tokens at the top of src/index.css.
@/components/patterns  DataTable, FormModal, ConfirmDialog, TextField, PageHeader,
                       EmptyState, ErrorState. Use these before building anything.
@/components/layout    AppShell, Navbar, Sidebar.
@/lib                  contracts (ListResult, AppError), utils, error-messages.
@/platform             THE ONLY app-level Supabase code (client.ts). Add auth.ts,
                       storage.ts etc. here as the project needs them — never
                       call `supabase` directly from a feature.
@/features/<name>      Everything for one feature.
@/app                  Routing, the query client, and auth guards. Add every new
                       page's route in app/router.tsx.
```

## Feature anatomy

```
features/<name>/
├── types/        domain types, camelCase, platform-neutral (skip if the feature has none yet)
├── schemas/      Zod schemas for forms
├── messages.ts   user-facing text for this feature's error codes (add when it has any)
├── components/   dumb: props in, callbacks out
├── forms/        RHF + Zod; emit onSubmit(values); show AppError on the matching field
├── views/        compose components + forms; dumb; may hold UI-only state
├── api/          keys, queries, mutations. Only place that calls @/platform or Supabase.
├── pages/        wiring: api hooks → view; route params; toasts
└── index.ts      public exports — other code imports this feature only from here
```

`features/auth/` and `features/dashboard/` already follow this shape — copy
whichever is closer to what you're building (`auth` for a form + mutation,
`dashboard` for a read-only view fed by a query hook).

### Dependency rules

```
components/ forms/ views/  ──►  types/, schemas/, messages.ts, @/components/*, @/lib
pages/                      ──►  everything above + api/
api/                        ──►  @/platform, types/, schemas/
other features              ──►  only '@/features/<f>' (its index.ts)
```

Never use raw `<button> <input> <select> <table>`. Use `@/components/ui` or
`@/components/patterns`.

## This is a blank starter — what that means for you

- **There is no database schema yet.** Don't invent tables, RPCs, or RLS
  policies. That's Phase 3 (foundation) and Phase 4 (Logic Doc) of
  `shared/workflow/` — a human-in-the-loop step before you build anything new.
- **`src/features/dashboard/api/dashboard.queries.ts` returns dummy data**,
  written in the exact shape a real query hook will have. When this project's
  schema exists, replace its body with a real Supabase call — nothing that
  calls `useDashboardStats()` needs to change. Follow the same pattern for any
  new feature: build the real UI against realistic fixture data first if its
  backend isn't ready yet, with a comment marking where the real call goes.
- **Login is real** (`features/auth/`) — Supabase Auth needs no project schema,
  so email/password sign-in works the moment `.env.local` points at a real
  project.
- **No RBAC yet.** `RowAction.permission` and `useCan`-style checks don't exist
  here. Once Phase 3 picks an RBAC tier (see `platforms/supabase/rbac/README.md`
  and `shared/rbac-model/spec.md`), add `src/rbac/` following the full
  `platforms/supabase/template/` as the reference, and re-wire
  `data-table/types.ts` / `RowActionsMenu.tsx` to use it.
- **No Axios, no raw `fetch` to Supabase** — features call `@/platform` only.

## Theming

Edit **only** the `:root` / `.dark` token blocks at the top of `src/index.css`
to rebrand a project (colors, radius, font — marked "TEMPLATE THEME
CONFIGURATION"). Also update the Google Fonts `<link>` in `index.html` if you
change `--font-sans`. Never hard-code a color or font in a component.

## Before marking a FID done

- `npm run lint && npm run typecheck`
- The feature's route is registered in `src/app/router.tsx`.
- No unrelated files changed.
