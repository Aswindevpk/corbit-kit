# Using `fidtrack` + `cortest`

A step-by-step guide. For command reference and how the rules work, see [README.md](README.md).

## 0. What the two programs are

| Program | Tracks | Stage |
|---|---|---|
| `fidtrack` | Development: has this feature been built per its approved logic? | Stage 1–2 |
| `cortest` | Testing: test cases, individual / integration / cross-feature / full-system checks | Stage 2–3 |

They share one record (`devtest/events.jsonl`) and one page (`FID_CHECKLIST.html`), so "complete"
means the same thing everywhere. No installs beyond Node 18+.

## 1. Start a new project

From inside the new project's folder (or pass it as an argument):

```bash
node <corbit-kit>/shared/tools/devtest/bin/fidtrack.js init . --name "Client Project"
```

Run it interactively (no `--from`) and it will ask for the project name, then let you paste the
feature list from the approved Feature Scope Document — one line per feature:

```
FID01 — User Management
FID01.1 — Registration
FID01.2 — Login
FID02 — Product Catalog
```

(Or point it at a file: `--from features.txt`.)

This creates the CDS folder structure, `AGENT.md`, `FID_CHECKLIST.html`, `FID_DIRECTORY.md`,
`ERROR_DICTIONARY.md`, and two launchers in the project root: `./fidtrack` and `./cortest`.
Commit all of it except `devtest/.env`.

## 2. Bring in the Logic Document

Once Phase 4 (Logic Document) is approved, split it into each feature's own `LOGIC.md`:

```bash
./fidtrack extract docs/master-logic.md
```

It matches headings like `## FID01.1 — Registration` and writes each section into
`FID/FID01-user-management/FID01.1-registration/features/LOGIC.md`. Re-run with `--force` after
a logic change to overwrite what's there.

If a feature's `LOGIC.md` section 6 (Acceptance Criteria) isn't numbered, write that first —
the tool reads those numbers to check coverage.

## 3. See what to build

```bash
./fidtrack status          # the whole tree
./fidtrack next            # what to build next, and where its logic/tests live
```

Or open the live checklist:

```bash
./fidtrack serve --open
```

This opens `http://localhost:4173` in your browser. Leave it running — everyone on the project
(developers, testers, AI agents) can open the same address and work at the same time.

## 4. Develop one feature

```bash
./fidtrack start FID01.1 --by "Your Name"     # confirms you read LOGIC.md
# ... build it ...
./fidtrack done  FID01.1 --by "Your Name"     # marks development complete
```

If the implementation lives outside that feature's own folder (e.g. `src/features/auth/`),
register it so changes there are tracked:

```bash
./fidtrack set FID01.1 --paths src/features/auth
```

Blocked on something? `./fidtrack block FID01.1 --note "Waiting on payment gateway keys" --by "Name"`,
and `./fidtrack unblock FID01.1 --by "Name"` once it clears.

## 5. Write test cases

Draft them from the acceptance criteria automatically:

```bash
./cortest generate FID01.1
```

This writes one draft per uncovered acceptance criterion (plus one per row of the failure table),
each with `"TODO"` steps for you to fill in. Drafts never count until approved.

Prefer to write them by hand or hand them to an AI? See §7 below, or edit the JSON directly at
`FID/.../features/tests/cases.json` and load it:

```bash
./cortest add --file cases.json
```

A **person** then approves them (AI agents cannot):

```bash
./cortest approve FID01.1 --by "QA Lead"
```

A case containing `TODO`, or with no steps, is refused — finish writing it first.

## 6. Run tests and record results

**Manual:**
```bash
./cortest record TC-FID01.1-01 pass --by "Tester Name"
./cortest record TC-FID01.1-02 fail --note "Password reset email never arrives" --by "Tester Name"
```

**Automated:** mark the case `"mode": "auto"`, put its id in the actual test's name
(`test('TC-FID01.1-01 rejects a weak password', ...)`), then:

```bash
./cortest run        # runs the commands configured in devtest/config.json, records real results
```

An automated case can only pass from a real test run — never from a manual tick.

## 7. Let an AI agent help

Every project gets an `AGENT.md` with the rules AI agents must follow (one feature at a time,
no faked results, no approving tests, etc.). To get instructions for one specific feature:

```bash
./cortest prompt FID01.1
```

Paste that into Claude, Antigravity, Cursor, whatever — it tells the agent exactly what to read
and what format to write test cases in. The agent runs every command with `--agent --by "<name>"`,
and the tool refuses certain actions from agents on purpose (approving cases, passing manual
tests, starting/passing C2, confirming the exit gate).

## 8. Integration, then cross-feature, then full system

Once a feature's children are all individually passing, write its integration case (L2) —
it links the feature to its children/dependencies:

```bash
./cortest add --file it-case.json   # level: "L2", links: ["FID01.1","FID01.2"]
./cortest approve FID01 --by "QA Lead"
./cortest record IT-FID01-01 pass --by "Tester Name"
```

Once **every** feature has finished Stage 2 (developed + individual + integration all passing),
C1 (all-feature integration) unlocks:

```bash
./cortest add --file c1-case.json   # level: "C1", links: [at least 2 FIDs], needs one "e2e-flow" type
./cortest approve C1 --by "QA Lead"
./cortest record C1-001 pass --by "Tester Name"
```

Then C2 — the one-go, full-system verification, run by a person:

```bash
./cortest c2 start --by "QA Lead"
./cortest c2 record FID01.1 pass --by "Tester Name"
# ... one result per item ...
./cortest c2 status
```

One failure invalidates the whole attempt. `./cortest c2 start` again begins a fresh attempt —
nothing carries over, but the history of every past attempt is kept.

## 9. Check readiness to hand over

```bash
./cortest gate
```

Lists every requirement of the Development Verification Exit Gate (all features developed and
tested, C1 passed, C2 passed, no open failures, build verified, docs prepared) and whether each
is met. Exits with code 1 until everything is green — handover should not happen before that.

## 10. Anytime

```bash
./fidtrack status [FID]     # tree view, or one feature with every reason it isn't complete
./cortest list --state fail # every failing test case
./fidtrack scan             # checks folders match the registry; --fix creates missing ones
./cortest report            # regenerates FID_CHECKLIST.html / FID_DIRECTORY.md / ERROR_DICTIONARY.md
```

## 11. Saving to a database (optional)

Everything is already saved to `devtest/events.jsonl` (commit it — that's your audit trail).
To also push it to Supabase, add `devtest/.env` (git-ignored):

```
SUPABASE_URL=https://<ref>.supabase.co
DEVTEST_SUPABASE_KEY=<service role key>
```

apply `devtest/tool/supabase/devtest_events.sql` once, and events sync automatically as they
happen (or catch up any time with `./cortest sync`). For Firebase/Django, set
`DEVTEST_WEBHOOK_URL` instead and handle the POST on your side.

## Things worth remembering

- A pass **expires** the moment that feature's logic, code, or the test case itself changes —
  re-run the test.
- Finishing every child feature does **not** complete the parent — the parent needs its own
  integration test.
- A failing integration or C1 case marks **every linked feature** as not complete, not just its own.
- Never hand-edit `devtest/events.jsonl`, `FID_CHECKLIST.html`, or `FID_DIRECTORY.md` — they're
  generated. Edit the FID registry/cases and re-run the tool instead.
