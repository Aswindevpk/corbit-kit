# Prompts

Use low temperature (0.1–0.2) for every phase except 7. Always paste the files
named in each prompt; never let the model work from memory of earlier chats.

---

## Phase 1: Clarification

```
You are a Principal Technical Business Analyst at Corbit Technologies.
Inputs: our Scope Standard and CLDS v3.0, the raw bounty cards, and a sample doc.

Do NOT write the scope yet. Do an exhaustive gap analysis and ask numbered,
direct questions, grouped by module, covering:
1. Business rules, lifecycles, calculations, soft vs hard delete.
2. Roles and permissions: who can do what, on which platform, in which branch/tenant.
3. Integrations: payments, SMS/OTP, push, storage, auth method.
4. Data relationships and ownership.
5. Multi-device and session rules.

Inputs:
---
[PASTE]
---
End with: "Reply with answers so we can draft the Feature Register."
```

## Phase 2: Feature register

```
You are the Systems Architect at Corbit Technologies.
From the bounty and the answers below, produce feature-register.md:
- Permanent FIDs (FID01.1 …), grouped into numbered modules (01-auth, 02-…).
- For each: name, 1–2 sentence description, platform (Mobile / Admin / Backend),
  actor + trigger, upstream and downstream FIDs, and the permission string it
  needs (module.action).
List features one by one for review.

Answers:
---
[PASTE]
---
```

## Phase 3: Foundation

```
You are the Lead Database Architect at Corbit Technologies, building on [PLATFORM].
Using the approved feature register, produce:

1. database-design.md: entities, keys, cardinality, cascade rules. Never let NULL
   carry business meaning (no "NULL tenant = super admin").
2. entity-field-register.md: every field with type, required, default, constraints.
   snake_case. Logic docs may only use fields listed here.
3. shared-system-rules.md: auth, roles, pagination (ListResult {rows,total}),
   UTC dates, error format (code + field).
4. ui-state-reference.md: use the IDs from shared/standards/ui-states.md.
5. rbac.md: recommend an RBAC tier from the platform's rbac/README.md with
   reasons, list every role with its permission strings, and write the persona
   matrix in the format of shared/rbac-model/personas.yaml.

Save 1–2 into db_structure/, and 3–5 into project-wide-rules-and-technical-foundation/
(both already created by `fidtrack init` / `new-project.js`).

Approved register:
---
[PASTE]
---
```

## Phase 4: Logic Doc (one FID)

```
You are a Senior Technical Systems Analyst at Corbit Technologies.
Write the logic doc for ONE feature using the six-section CLDS template.

Context: db_structure/entity-field-register.md, and from
project-wide-rules-and-technical-foundation/: shared-system-rules.md, ui-state-reference.md, rbac.md
Feature: [FID] [Name]

Rules:
1. Sections: 1 Overview · 2 Inputs and Validation · 3 Execution Logic (numbered,
   explicit If/Otherwise) · 4 Contract · 5 Outcomes, UI and Failures · 6 Acceptance Criteria.
2. Section 4 must contain, as code blocks:
   - the operation signature (name, typed params, return shape),
   - the permission string required and how tenant scope is resolved,
   - every error code with its form `field` (see shared/standards/error-codes.md),
   - whether it is atomic, and which side effects go to the outbox.
3. Section 6: number every criterion as a plain numbered list (1. 2. 3. …), each a
   testable case — actor/persona, input, expected result or error code. `cortest`
   reads these numbers to draft and check test coverage, so they must be numbered,
   not bulleted prose.
4. Use only fields from entity-field-register.md. If one is missing, stop and say so.

Find where to write it with `./fidtrack path [FID]` — write there directly, or to a
scratch file and adopt it with `./fidtrack logic [FID] <file>` once approved.
```

**Submitting it for approval:** once section 6's criteria are numbered, compile it to a
PDF with `fiddocs --fid [FID]` (install once: `pip install
git+https://github.com/Aswindevpk/corbit-kit.git#subdirectory=shared/tools/fid-docs-pdf`).
Send that PDF for approval. Only after it's approved does Phase 5 (build) begin for
that FID — `fiddocs` skips a FID whose `LOGIC.md` is still the empty template, so an
accidentally-early PDF comes back empty rather than wrong.

## Phase 5: Build (four sessions per FID)

Start with `./fidtrack start [FID] --by "<name>"` (confirms the logic was read) and
end with `./fidtrack done [FID] --by "<name>"` (only once step 5d's checks are green).
Run each session in the agent (Antigravity / Claude Code / Cursor) inside the project,
which already contains `AGENT.md` (process), `AGENTS.md` (code rules) and the golden
feature. Get each FID's logic doc path with `./fidtrack path [FID]`.

**5a. Backend**
```
Read AGENTS.md and the logic doc at [path from `fidtrack path [FID]`].
1. Write the backend tests first from Section 6 (one test per AC).
2. Implement the migration/function until all tests pass.
3. Regenerate types. Do not touch src/.
Follow the patterns in the golden feature's backend files.
```

**5b. api/**
```
Read AGENTS.md, the logic doc Section 4, and src/features/branches/api/ as the reference.
Create src/features/[feature]/types/, api/ (keys, queries, mutations, mappers) and
mapper tests. Domain types are camelCase and platform-neutral. Do not create UI.
```

**5c. Dumb UI**
```
Read AGENTS.md, src/features/[feature]/types/, schemas/, and
src/features/branches/{components,forms,views}/ as the reference.
Build components/, forms/, views/ for [feature]. Props in, callbacks out.
Use only @/components/ui and @/components/patterns. No api/, no platform imports.
```

**5d. Page + wiring**
```
Read AGENTS.md and src/features/branches/pages/ as the reference.
Create pages/[Feature]Page.tsx wiring the api hooks to the view, add the route
and nav entry with its permission. Run lint, typecheck and tests; fix until clean.
Then: ./fidtrack done [FID] --by "<name>"
```

## Phase 6: Test (`cortest`, not a hand-written QA sheet)

No prompt to paste — this phase is commands, because results must come from a real
run, never from an AI's say-so (`cortest` refuses an AI agent's "pass" on a manual
case). Full reference: `shared/tools/devtest/GUIDE.md`.

```
./cortest generate [FID]              # drafts one case per numbered acceptance
                                       # criterion in Section 6, plus the failure table
#  … fill in the exact steps the draft leaves as TODO …
./cortest approve [FID] --by "QA Lead"    # a person approves; an AI agent cannot
./cortest record TC-[FID]-01 pass --by "Tester Name"
./cortest record TC-[FID]-02 fail --note "what went wrong" --by "Tester Name"
./cortest status [FID]                 # every reason this FID isn't complete yet
```

An AI agent may run `generate` and may draft the steps for a human to review, but
only a person approves a case or passes a manual result. For a case you can
automate, mark it `"mode": "auto"`, put its id in the real test's name, and record
it with `./cortest run` instead — see the guide for the exact wiring.

If the feature register asked for anything beyond its own acceptance criteria —
cross-feature behaviour, a full end-to-end flow — that is C1/C2 in `cortest`, run
once every FID in the module is through this phase (see the guide).

## Phase 7: Handover

```
You are the Technical Product Manager at Corbit Technologies.
From the approved logic docs, produce, saved to docs/handover/:
1. A user manual in plain, non-technical English: getting started, one section per
   task, troubleshooting (using the real error messages from messages.ts).
2. A walkthrough script table: Scene | Platform | Screen | Action | Narration |
   What to highlight. Cover happy paths and the key safeguards.
```

Before this phase, run `./cortest gate` — it is the single readiness check (every FID
developed and tested, cross-feature integration passed, one full end-to-end
verification passed, no open failures, build verified, docs prepared) and exits
non-zero until every item is met. Handover should not start before it is.
