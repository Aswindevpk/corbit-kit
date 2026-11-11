# Corbit Supabase Starter

The blank starter: theme, shadcn UI, a real login, and a dashboard shell with
dummy data. No SQL, no RBAC, no business feature — just the shell every new
project begins from, built with `fidtrack`/`cortest` and `shared/workflow/` in
mind.

If you want a project that already has RBAC, a full example feature and
Supabase migrations wired up (useful as an AI pattern reference), use
`platforms/supabase/template` instead. This starter is the one to pick when
you'd rather build the schema and every feature from scratch, per project.

## Run it

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project's URL and anon key
npm run dev
```

It runs with **no** `.env.local` too — `src/platform/client.ts` falls back to a
placeholder project, so the dashboard's dummy data and the UI are visible
immediately. Login needs a real Supabase project with email/password auth
enabled.

## What's real vs dummy

| Feature | Status |
|---|---|
| Theme, shadcn UI, layout | Real — this is the actual UI you'll build on |
| Login (`features/auth`) | Real — Supabase Auth needs no project schema |
| Dashboard stats (`features/dashboard`) | **Dummy** — written in the exact shape a real query hook has; swap its body for a real call once there's a schema |

## Next steps

1. Follow `shared/workflow/README.md` from Phase 3 (this project already has
   its UI shell — skip straight to the database/foundation phase).
2. Read `AGENTS.md` before building a feature; it has the folder anatomy and
   dependency rules.
3. Track development and testing with `fidtrack`/`cortest` — see
   `shared/tools/devtest/GUIDE.md` at the kit root.

## Rebranding

Edit the `:root` / `.dark` token blocks at the top of `src/index.css` only
(marked "TEMPLATE THEME CONFIGURATION"). Update the font `<link>` in
`index.html` to match if you change `--font-sans`.
