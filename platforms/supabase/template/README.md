# Corbit Supabase template

React + TypeScript + Vite + Tailwind v4 + shadcn, on Supabase.
Includes RBAC, the transactional outbox, and one complete reference feature (Branches).

## Run it

Prerequisites: Node 20+, Docker, the Supabase CLI.

```bash
npm install
supabase init            # once; keeps the existing supabase/migrations
supabase start           # local Postgres, Auth, Studio
cp .env.example .env.local   # fill VITE_SUPABASE_ANON_KEY from `supabase status`
npm run db:reset         # applies migrations + seed, regenerates types
npm run dev
```

Then create the first super admin:

1. Sign up a user in Studio (Authentication → Add user) and copy its UUID.
2. In the SQL editor:
   ```sql
   insert into public.memberships (user_id, role_id, scope)
   select '<USER_UUID>', id, 'global' from public.roles where key = 'super_admin';
   ```
3. Sign in at http://localhost:5173.

## Checks

```bash
npm run check     # lint (architecture rules) + typecheck + unit tests
npm run test:db   # pgTAP: RBAC and feature tests
```

## Where things are

| Path | What |
|---|---|
| `AGENTS.md`, `supabase/AGENTS.md` | Rules for AI agents and developers |
| `src/styles/theme.css` | The only file to edit when rebranding |
| `src/components/ui` | shadcn primitives |
| `src/components/patterns` | DataTable, FormModal, ConfirmDialog, TextField, … |
| `src/platform` | Supabase client, auth, error normalisation, storage |
| `src/rbac` | Permission hooks and guards |
| `src/features/branches` | **Reference feature**: copy its structure |
| `supabase/migrations` | RBAC core, outbox, branches |
| `supabase/tests` | pgTAP tests |
| `supabase/functions/process-outbox` | Outbox worker |
| `docs/` | Workflow outputs; `02-organisation/FID02.1-branches.md` is the reference logic doc |

## Starting a real project from this template

1. Copy this folder into a new repository.
2. Replace the role seed in `supabase/seed.sql` with your chosen tier
   (`platforms/supabase/rbac/seeds/`).
3. Turn on single-device sessions if the project needs them:
   `internal.single_session_enabled()` → `select true` (new migration) and
   `singleSession: true` in `src/config/app.config.ts`.
4. Rebrand in `src/styles/theme.css` and `index.html` (font).
5. Add integrations from `platforms/supabase/integrations/`.
6. Keep `features/branches` until the team has built two features by following it.
   It is the example agents copy.

## Known gaps

- Not yet run end-to-end. Run `npm install` and `npm run check` first and fix
  anything the current package versions disagree with.
- No user/role management screens yet. RPCs exist (`assign_membership`,
  `revoke_membership`); build the screens as the next feature using the same pattern.
- No automatic sign-out when another device signs in. The database rejects the old
  session's requests; to show `SESSION_REPLACED` immediately, subscribe to the
  user's `profiles.active_session_id` via Realtime in `src/platform/auth.tsx`.
