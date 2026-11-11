# devtest: `fidtrack` + `cortest`

Two programs that enforce the COR Development Standard (CDS) inside a project, so that
"complete" is computed from evidence instead of being someone's opinion.

| Program | Stage | What it does |
|---|---|---|
| `fidtrack` | Stage 1 and 2, development | Builds the FID tree and folders, tracks development per FID |
| `cortest` | Stage 2 testing, Stage 3 | Test cases, scenario types, individual / integration / C1 / C2 checklists, exit gate |

Both read and write the same record, and both open the same page, `FID_CHECKLIST.html`,
which is the single central tracker the standard requires.

No installs: Node 18 or newer is the only requirement. There are no dependencies.

## Start a project

```bash
node <corbit-kit>/shared/tools/devtest/bin/fidtrack.js init my-project --name "My Project" --from features.txt
```

`features.txt` is the feature list from the approved Feature Scope Document, one per line
(`FID01 — User Management`, `FID01.1 — Registration`, ...). Without `--from` the command asks
for the name and lets you paste the list.

This creates the CDS root structure, copies the tool into `devtest/tool/`, and adds two
launchers, so from then on, inside the project:

```bash
./fidtrack extract docs/master-logic.md   # split the Logic Document into each FID's LOGIC.md
./fidtrack serve --open                   # the interactive checklist in the browser
```

```
PROJECT_ROOT/
├── AGENT.md                      rules for AI agents (generated once, then yours to extend)
├── FID/
│   └── FID01-auth/
│       ├── features/             LOGIC.md, tests/cases.json, implementation files
│       └── FID01.1-sign-up/
│           └── features/         LOGIC.md, tests/cases.json, implementation files
├── FID_DIRECTORY.md              generated
├── FID_CHECKLIST.html            generated snapshot (read-only when opened from disk)
├── ERROR_DICTIONARY.md           yours + a generated "verification failures" block
├── devtest/
│   ├── config.json               project settings
│   ├── fids.json                 the FID registry
│   ├── c1.json                   cross-feature (C1) cases and end-to-end flows
│   ├── events.jsonl              the record: append-only, one line per action
│   └── tool/                     this tool
└── fidtrack, cortest             launchers (.cmd versions for Windows)
```

Commit everything except `devtest/.env`. Git history of `events.jsonl` is the audit trail.

## The flow

```
Feature Doc → Logic Doc → fidtrack init / extract
   → per FID:  fidtrack start → write cases → build → cortest run → fidtrack done
   → cortest: L1 individual → L2 integration → C1 all-feature → C2 one-go → gate
```

### Program 1: development (`fidtrack`)

```bash
./fidtrack next                      # what to build next, where its logic lives
./fidtrack start FID03.2 --by "Anu"  # LOGIC.md read, development begins
./fidtrack done  FID03.2 --by "Anu"  # development complete
./fidtrack status FID03.2            # every reason this FID is not complete yet
./fidtrack block FID03.2 --note "Waiting for payment gateway keys" --by "Anu"
./fidtrack set FID03.2 --paths src/features/variants --depends FID03.1
./fidtrack scan                      # folders vs registry, regenerate FID_DIRECTORY.md
```

`--paths` tells the tool where the implementation lives when it is outside the FID folder
(for example `src/features/<feature>/` in the kit's templates). Changes there expire the
FID's passes. `--depends` records which FIDs this one relies on.

### Program 2: testing (`cortest`)

**1. Test cases.** One per acceptance criterion at minimum; drafts never count.

```bash
./cortest generate FID03.2           # drafts from LOGIC.md section 6 and the failure table
./cortest prompt FID03.2             # instructions for an AI agent to write full coverage
./cortest add --file cases.json      # load cases written by a person or an AI
./cortest approve FID03.2 --by "QA Lead"   # a person approves; AI agents cannot
```

```json
{
  "fid": "FID03.2", "level": "L1", "type": "functional", "mode": "manual",
  "title": "Generator creates one variant per size and colour combination",
  "precondition": "Product creation form open for 'Cotton T-Shirt'",
  "steps": ["Add Size S, M, L and Color Red, Blue", "Tap Generate Variants Matrix"],
  "expected": "6 unique variant rows with auto-generated SKUs",
  "covers": ["AC-1"]
}
```

**2. Scenario types** (`./cortest types`): functional, validation, permission, edge-failure,
ui-state, data-integrity, integration, e2e-flow, regression. The checklist shows which types
each FID is covered by.

**3. Levels.**

| Level | Checklist | Owner | Rule |
|---|---|---|---|
| L1 | Stage 2, individual feature testing | one FID | Every acceptance criterion covered, every case passing |
| L2 | Stage 2, child and integration verification | a parent FID, or a FID with dependencies | A failure marks the owner **and every linked FID** not complete |
| C1 | Stage 3, all-feature integration | `devtest/c1.json`, links ≥ 2 FIDs | Unlocks when Stage 2 is complete. Needs a case for every cross-module dependency and at least one `e2e-flow`. A failure marks every linked FID not complete |
| C2 | Stage 3, one-go complete system verification | a numbered attempt | Every FID and every end-to-end flow in one attempt. One failure invalidates it; the next attempt starts blank; history is kept |

**4. Recording results.**

```bash
./cortest record TC-FID03.2-01 pass --by "Ravi"
./cortest record TC-FID03.2-02 fail --note "Override price lost after save" --by "Ravi"
./cortest run                         # run automated tests, record their real results
./cortest c2 start --by "Ravi"
./cortest c2 record FID03.2 pass --by "Ravi"
./cortest gate                        # the Development Verification Exit Gate; exit code 1 until ready
```

Or do all of it in the browser with `./cortest serve`. To let several testers work at once,
run `./cortest serve --host` on one machine and open its address from the others.

### Automated tests

Mark a case `"mode": "auto"` and put its id in the test's name:

```ts
test('TC-FID03.2-01 generates six variants', async () => { ... })
```

Tell the tool how to run your tests in `devtest/config.json`:

```json
"automation": [
  { "name": "unit", "command": "pnpm vitest run --reporter=junit --outputFile=reports/unit.xml", "junit": "reports/unit.xml" },
  { "name": "e2e",  "command": "pnpm playwright test --reporter=junit", "junit": "reports/e2e.xml" }
]
```

`./cortest run` runs them and records pass or fail per case id from the JUnit report
(pytest, Vitest, Jest, Playwright, Flutter and most others can write one). An automated case
can only be passed this way. During a C2 attempt use `./cortest run --c2`.

## What the tool enforces

- A name on every action. AI agents are marked as agents (`--agent`).
- No testing a FID that is not developed. No "developed" before LOGIC.md is read.
- Draft cases do not count. Only a person can approve a case, and a case containing `TODO` cannot be approved.
- An AI agent cannot pass a manual case, approve a case, start or pass C2, or confirm the gate.
- An automated case passes only from a real test report.
- A fail or a blocker needs a note. Failures appear in `ERROR_DICTIONARY.md` until re-verified.
- Acceptance criteria with no test keep the FID not complete (`strictCoverage`, on by default).
- Finishing every child never completes the parent; the parent needs its own integration test.
- **A pass expires** when the FID's `LOGIC.md`, its code (`features/` and `--paths`), or the test case changes.
- C2 results are never carried forward; changing code during an attempt invalidates it; a C2 pass goes stale when anything changes afterwards.
- The record is append-only. Status is always recomputed from it, never stored.

## Saving to a database

The record is always written to `devtest/events.jsonl`. To also save it to a database, create
`devtest/.env` (it is git-ignored):

```
SUPABASE_URL=https://<ref>.supabase.co
DEVTEST_SUPABASE_KEY=<service role key>
```

and apply `devtest/tool/supabase/devtest_events.sql` once. Every action is then pushed to the
insert-only `devtest_events` table as it happens. `./cortest sync` pushes the whole log again
(safe to repeat: rows are keyed by event id), which is how you catch up after working offline.
The migration also creates views for dashboards across projects: latest result per case,
development status per FID, and C2 attempt history.

Not on Supabase? Set `DEVTEST_WEBHOOK_URL=https://...` instead (or as well). Each action is
POSTed there as `{ "project": "...", "events": [ ... ] }`, so a Firebase function or a Django
view can store it.

The local server is itself an endpoint, documented at the top of `lib/server.js`
(`POST /api/events`, `GET /api/state`, ...).

## Files in this tool

```
bin/         fidtrack.js, cortest.js
lib/rules.js     the status rules: pure functions, no I/O. Change behaviour here, and only here
lib/project.js   files, fingerprints, event log, generated outputs, database sync
lib/server.js    local API + live checklist
lib/cli.js       both command lines
web/checklist.html   the checklist page (live when served, read-only snapshot when written to disk)
templates/AGENT.md   copied into each project
supabase/        database migration
test/            node --test test/   (the rules, end to end, on a temporary project)
examples/        MyMerca feature list and sample logic / cases
```
