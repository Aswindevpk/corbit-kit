# Workflow: 7-phase human-in-the-loop

Each phase ends at a gate. Nothing moves forward until a human approves the output.
Phases 3–6 are tracked by `shared/tools/devtest/` (`fidtrack` + `cortest`) — see
`platforms/<platform>/README.md` and `shared/tools/devtest/GUIDE.md` for the exact
commands. Start a project with `node new-project.js <dest> --name "..." --from
features.txt` at the kit root: it clones the platform template and sets up the FID
tree from the feature list in one step.

| Phase | Output | Where it lives | Gate |
|---|---|---|---|
| 1. Clarification | Numbered questions on gaps | — (chat) | You answer every question |
| 2. Feature register | FIDs, one per feature | `features.txt` passed to `new-project.js` / `fidtrack import` | Scope frozen |
| 3. Foundation | DB design, field register, shared rules, UI states, **RBAC tier + persona matrix** | `db_structure/`, `project-wide-rules-and-technical-foundation/` | Schema frozen |
| 4. Logic Doc (per FID) | 6-section CLDS doc incl. **RPC/API contract, error codes, acceptance criteria** | `FID/<path>/features/LOGIC.md` (`fidtrack path` / `fidtrack logic`) | Logic approved (PDF via `fiddocs --fid [FID]`) |
| 5. Build (per FID) | Backend + tests, then `api/`, then dumb UI, then page | `src/features/<feature>/`, tracked by `fidtrack start`/`done` | Tests green, lint clean, `fidtrack done` |
| 6. Test (per FID) | Test cases from Section 6, run, recorded | `FID/<path>/features/tests/` (`cortest generate`/`approve`/`record`) | `cortest status <FID>` shows complete |
| 7. Handover | User manual + walkthrough script | `docs/handover/` | Client sign-off, `cortest gate` ready |

## Why outputs live in the FID tree, not a parallel `docs/` folder

Earlier versions of this workflow wrote Phase 3–4 output to `docs/00-foundation/` and
`docs/01-<module>/FIDxx.x-<slug>.md`. That is a second place to keep in sync with the
FID tree `fidtrack` already tracks — two trees drift. Everything project-specific now
lives in the one tree the COR Development Standard defines:

```
PROJECT_ROOT/
├── project-wide-rules-and-technical-foundation/   # Phase 3: shared-system-rules.md, ui-state-reference.md, rbac.md
├── db_structure/                                  # Phase 3: database-design.md, entity-field-register.md
├── FID/
│   └── FID01-user-management/
│       ├── features/              # FID01's own logic/tests, if it has any directly
│       └── FID01.1-registration/
│           └── features/
│               ├── LOGIC.md       # Phase 4 output for FID01.1
│               └── tests/         # Phase 6: cases.json (cortest)
└── docs/handover/                 # Phase 7 only — the one phase with no FID home
```

`fidtrack init` (or `new-project.js`) creates the first two folders and the whole `FID/`
tree from the feature list automatically.

## Changes from the original workflow

- **Phase 3 chooses the RBAC tier** (see `platforms/<platform>/rbac/README.md`) and
  writes the persona matrix. Every later logic doc references permission strings from it.
- **Phase 4, Section 4 is a contract, not prose**: the RPC/endpoint signature, the
  permission it requires, its error codes with `field` names, and numbered acceptance
  criteria in Section 6. `cortest` reads Section 6 directly to draft test cases and to
  check nothing is left untested — write it as a numbered list, not prose.
- **Phase 5 runs in four narrow agent sessions**, in order: backend, `api/`, dumb UI,
  page. Each session only sees the files it needs (see `prompts.md`). Agents follow
  `AGENT.md` (process: which FID, when it's done) and `AGENTS.md` (code: architecture,
  folder anatomy) — both are created by `new-project.js` / `fidtrack init`.
  `fidtrack start <FID>` / `fidtrack done <FID>` mark its progress.
- **Phase 6 is `cortest`, not a hand-written QA sheet.** `cortest generate <FID>` drafts
  one test case per acceptance criterion (plus the failure table) from `LOGIC.md`; a
  person approves them; `cortest record` / `cortest run` capture results. A FID only
  counts as tested when every criterion has an approved, passing case — see
  `shared/tools/devtest/README.md` for exactly what's enforced.
- No Axios: features call the platform through `api/` hooks only.
- Before handover, run `cortest gate` — it lists every exit requirement (every FID
  developed and tested, cross-feature integration passed, one-go full verification
  passed, no open failures) and whether each is met.

See `prompts.md` for the prompt text.
