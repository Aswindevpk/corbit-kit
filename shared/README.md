# shared/

Only things that are identical on every platform live here. If a file would need
"if Supabase … if Django …" inside it, it belongs in `platforms/<platform>/` instead.

| Folder | What it holds |
|---|---|
| `workflow/` | The 7-phase human-in-the-loop workflow and its prompts |
| `standards/` | Feature folder anatomy, naming, error-code registry, UI states |
| `rbac-model/` | Permission strings, scopes, roles, and the persona test matrix |
| `ui-registry/` | How UI patterns are shared across platform templates |
| `tools/devtest/` | `fidtrack` and `cortest`: FID development tracking, test cases, L1 / L2 / C1 / C2 verification, exit gate |
