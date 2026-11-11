# Supabase starter (blank)

A blank, UI-complete starting point: theme, shadcn components, a real login,
a dummy-data dashboard shell. No SQL, no RBAC, no example business feature.

```
supabase-starter/
└── template/   # the project you clone — see its own README.md and AGENTS.md
```

## Start here: new project

```bash
node new-project.js <dest> --name "..." --from features.txt --platform supabase-starter
```

Then follow the new project's own `README.md`.

## When to use this instead of `platforms/supabase/template`

| | `supabase-starter` | `supabase/template` |
|---|---|---|
| SQL / migrations | None | RBAC core + a full example feature |
| RBAC | None (add it in Phase 3 once a tier is chosen) | Pre-built, all 5 tiers |
| Example feature to copy from | None yet | `src/features/branches/` |
| Best for | Starting the schema and every feature from scratch | Using the pre-built pattern as an AI reference while you build |

Both follow the same `shared/standards/feature-anatomy.md` and the same
`fidtrack`/`cortest` workflow — moving between them, or combining pieces of
both, costs nothing structural.
