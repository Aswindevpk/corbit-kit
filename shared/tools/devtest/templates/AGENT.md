# AGENT.md — {{PROJECT}}

Instructions for every AI development agent (Antigravity, Claude, Cursor, Copilot and others)
working in this project. They carry the same weight as the COR Development Standard (CDS).
Human developers follow the same rules.

This file is **the process**: which FID to work on, how it's tracked, how it's tested.
If this project also has an `AGENTS.md` (plural), that file is **the code**: the
architecture, folder anatomy and coding rules. Read both; this file tells you when to
read `AGENTS.md` and which commands move a FID forward.

## The two programs

Progress and verification are tracked by two programs in the project root. Never track status
anywhere else (no `FID_TRACKER.md`, no status notes in chat, no hand edits).

| Program | Use it for |
|---|---|
| `./fidtrack` | Development: the FID tree, folders, what to build next, marking development done |
| `./cortest` | Testing: test cases, running and recording tests, C1, C2, the exit gate |

**Add `--agent --by "<your agent name>"` to every command you run.** Example:
`./fidtrack done FID03.2 --agent --by "Antigravity"`.

## Hard rules

1. **Never edit by hand:** `devtest/events.jsonl`, `FID_CHECKLIST.html`, `FID_DIRECTORY.md`, or the
   generated block in `ERROR_DICTIONARY.md`. They are written by the programs only.
2. **Never invent a result.** A pass is recorded only by a real test run (`./cortest run`) or by a
   person. You cannot pass a manual test case, approve a test case, start or pass a C2 attempt, or
   confirm the exit gate. The programs will refuse; do not look for a way around the refusal.
3. **Never mark work complete without evidence.** `./fidtrack done` means the implementation satisfies
   every statement in the FID's `LOGIC.md`, not that code exists.
4. **One FID at a time.** Do not modify other FIDs' folders or unrelated code. If a change to another
   FID is unavoidable, say so: its passed tests will expire and it must be re-verified.
5. **Do not change scope or logic silently.** If `LOGIC.md` is unclear, incomplete or wrong, stop and
   report the gap. Do not guess and do not edit `LOGIC.md` to match your code.
6. **Report honestly.** Failures, blockers, assumptions and unfinished work are reported as they are.
   Use `./fidtrack block <FID> --note "..."` when you cannot proceed.

## Workflow for one FID

```
./fidtrack next --agent --by "<name>"            # what to build, where its logic and tests live
```

0. If `FID/<path>/features/LOGIC.md` is still the empty template (section 6 has no numbered
   criteria), the Logic Document for this FID hasn't been written yet. Stop: that is Phase 4
   of `shared/workflow/` (a human-in-the-loop step), not part of building. Once it's written
   and approved, it is adopted into place with `./fidtrack logic <FID> <file>` — then continue.
1. Read the FID's `features/LOGIC.md` completely, then this project's `AGENTS.md` (if present —
   the coding rules) and the project-wide rules in `project-wide-rules-and-technical-foundation/`,
   `db_structure/`, and `ERROR_DICTIONARY.md`.
2. Read the `LOGIC.md` of every FID listed under "Depends" and inspect the existing implementation
   before changing anything.
3. `./fidtrack start <FID> --agent --by "<name>"`
4. Write the test cases **before** the implementation:
   `./cortest prompt <FID>` prints the exact format and the coverage required. Load them with
   `./cortest add --file <file> --agent --by "<name>"`. They are drafts until a person approves them.
5. Implement the feature exactly as `LOGIC.md` describes. If the implementation lives outside the FID
   folder (for example `src/features/...`), register it so changes are tracked:
   `./fidtrack set <FID> --paths src/features/<feature>`
6. For every case with `"mode": "auto"`, write an automated test whose **name contains the case id**
   (for example `test('TC-FID03.2-01 generates six variants', ...)`).
7. Run the tests: `./cortest run`. Read the output. Fix the code, not the test, unless the test
   contradicts `LOGIC.md`.
8. `./fidtrack done <FID> --agent --by "<name>"` only when step 7 is green.
9. `./cortest status <FID>` and report to the developer exactly what it prints: what passed, what is
   pending for a person (manual cases, approvals), and every reason the FID is not complete.

## What "complete" means

A FID is complete only when all of these are true. The programs compute this; you cannot set it.

- Development is marked done.
- Every acceptance criterion in `LOGIC.md` section 6 is covered by an approved test case.
- Every approved individual (L1) case has passed.
- A parent FID, or a FID with dependencies, has passing integration (L2) cases.
- Every child FID is complete. Finishing the children does not complete the parent.
- No failing integration or C1 cross-feature test touches it.
- Nothing changed since: **a pass expires when the FID's `LOGIC.md`, its code, or the test case
  changes.** After any change, re-run the tests.

Stage 3: C1 (all-feature integration) unlocks when every FID has finished Stage 2. C2 (one-go complete
system verification) is run by a person; a single failure invalidates the whole attempt and the next
attempt starts from zero. Do not change code while a C2 attempt is running.

## Useful commands

```
./fidtrack status [FID]        ./cortest list [FID] --state fail
./fidtrack scan                ./cortest types
./cortest status [FID]         ./cortest gate
```
