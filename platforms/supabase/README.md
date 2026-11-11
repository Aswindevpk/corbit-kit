# Supabase platform pack

Everything needed to build a Corbit project on Supabase, optimised for Supabase.

```
supabase/
├── template/        # complete runnable project (start here)
├── rbac/            # tier decision guide + role seeds
├── patterns/        # copy-paste SQL patterns: RPC template, audit log
├── integrations/    # MSG91 OTP, FCM push, Razorpay webhooks
└── docs/            # how we write RPCs, RLS, migrations, the outbox
```

## Start here: new project

1. **Workflow Phases 1–2** (`shared/workflow/`): scope and the FID feature list,
   saved as `features.txt`.
2. **From the kit root**: `node new-project.js <dest> --name "..." --from features.txt`
   (defaults to this platform). This copies `template/` and runs `fidtrack init`
   against the feature list in one step — do not copy `template/` by hand, or the FID
   tree and the feature list fall out of sync. Then follow the new project's own
   README to run it locally.
3. **Phase 3**: pick the RBAC tier with `rbac/README.md` and write
   `project-wide-rules-and-technical-foundation/rbac.md`. **Seed roles** for that tier:
   replace the roles block in `supabase/seed.sql` with the matching file from `rbac/seeds/`.
4. **Rebrand**: `src/styles/theme.css`, the font link in `index.html`, `src/config/app.config.ts`.
5. **Add integrations** you need from `integrations/` (each has its own README).
6. **Per feature (Phases 4–6)**: Logic Doc (`./fidtrack path [FID]` / `fidtrack logic`)
   → pgTAP tests → migration → `npm run db:types` → `api/` → dumb UI → page
   (`fidtrack start`/`done` tracks it) → test cases (`cortest`). Agents follow
   `AGENT.md` (process) and `AGENTS.md` (code rules), and copy `src/features/branches/`.

## How Supabase concepts map to our architecture

| Concern | Where it lives |
|---|---|
| Business rules, state transitions | Postgres RPCs (`security definer` for writes) |
| Authorization | RLS + `internal.has_permission()` |
| Invariants | Constraints (check, unique, exclusion) |
| Side effects (push, SMS, PDFs) | `internal.enqueue()` → `process-outbox` Edge Function |
| Webhooks | Edge Function verifies signature → idempotent RPC |
| Frontend types | `supabase gen types` (`npm run db:types`) |
| Backend tests | pgTAP (`npm run test:db`) |
| Frontend boundary | `src/platform/` + each feature's `api/` |

## Docs

- `docs/rpc-guide.md`: writing RPCs and error codes
- `docs/rls-guide.md`: RLS patterns and the mistakes that break them
- `docs/migrations-and-types.md`: migration workflow and type generation
- `docs/outbox.md`: side effects, retries, scheduling the worker
