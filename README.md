# Corbit Kit

The agency starter kit: standards, AI workflow, RBAC, UI patterns, and one
complete, optimized playbook per backend platform.

```
corbit-kit/
├── new-project.js          # clone a platform template + set up fidtrack/cortest, in one step
├── shared/                 # identical on every platform
│   ├── workflow/           # 7-phase HITL workflow + prompts
│   ├── standards/          # feature anatomy, naming, error codes, UI states
│   ├── rbac-model/         # the permission model + persona test matrix
│   ├── ui-registry/        # how UI patterns are shared between templates
│   └── tools/devtest/      # fidtrack + cortest: FID development and verification tracking
└── platforms/
    ├── supabase/           # ✅ complete: full template (RBAC, SQL, example feature)
    ├── supabase-starter/   # ✅ complete: blank template (UI/theme/login only, no SQL)
    ├── firebase/           # 🟡 planned: README describes the target shape
    └── django/             # 🟡 planned: README describes the target shape
```

## Starting a new project

1. Run the workflow in `shared/workflow/` through Phase 2 (scope, feature register —
   just the FID list, e.g. `FID01 — User Management`, one per line, saved as `features.txt`).
2. ```bash
   node new-project.js my-client-project --name "Client Project" --from features.txt
   ```
   This clones `platforms/<platform>/template` (default: `supabase` — the full RBAC+SQL
   template; pass `--platform supabase-starter` for the blank UI-only one, see its
   README for when to pick which) into the new folder and runs `fidtrack init` against
   the feature list, creating the FID tree, `AGENT.md` (process) alongside the
   template's `AGENTS.md` (code rules), and `FID_CHECKLIST.html`.
3. Continue the workflow inside the new project: Phase 3 (foundation docs, RBAC tier —
   see `platforms/<platform>/rbac/README.md`) → Phase 4 (one Logic Doc per FID, written
   to the path `./fidtrack path [FID]` shows, submitted for approval as a PDF with
   `fiddocs --fid [FID]`) → Phase 5 (build: backend → `api/` → dumb UI → page, per
   `shared/standards/feature-anatomy.md`, tracked by `fidtrack start`/`done`) →
   Phase 6 (test with `cortest`) → Phase 7 (handover, gated by `cortest gate`).
   Full detail: `shared/workflow/README.md` and `prompts.md`.
4. A FID is complete only when `fidtrack`/`cortest` compute it so from real evidence —
   never hand-marked. See `shared/tools/devtest/README.md` and `GUIDE.md`.

## The one idea behind everything

The UI is dumb and platform-neutral. Business logic lives in the backend.
The only platform-specific frontend code is `src/platform/` and each feature's
`api/` folder. Moving a project to another backend means rewriting those
two places and the backend; components, views, forms and pages stay as they are.

## Status

- Platform packs other than Supabase are intentionally empty. Build each one
  against a real project, using the Supabase pack's shape as the blueprint.
- Nothing in this kit has been run against a live project yet. Treat the first
  project as the shake-down: fix what breaks here, not only in the project.
