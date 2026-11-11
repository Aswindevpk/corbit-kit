# FID02.1 Branches

Reference logic doc. Each section notes where it becomes code.

## 1. Feature overview

| | |
|---|---|
| Actor | Head-office admin (create, archive, restore); branch manager (edit own branch) |
| Trigger | Admin panel → Branches |
| Preconditions | Signed in; holds `branches.read` in at least one scope |
| Upstream | FID01.x Authentication |
| Downstream | Every tenant-scoped feature (staff assignment, fees, attendance) |
| Screen | `/branches` |
| Entity | `tenants` (called "branches" in the UI) |

## 2. Inputs and validation

| Input | Field | Type | Required | Rule | Failure |
|---|---|---|---|---|---|
| Code | `tenants.code` | text | yes (create only) | Trimmed, upper-cased, `^[A-Z0-9-]{2,20}$`, unique, immutable after create | `INVALID_BRANCH_CODE` / `BRANCH_CODE_TAKEN` on `code` |
| Name | `tenants.name` | text | yes | Trimmed, 2–120 chars | `INVALID_BRANCH_NAME` on `name` |

→ `schemas/branch-form.schema.ts` (UX) and the RPC validation (authoritative).

## 3. Execution logic

**List**
1. Return branches visible to the caller (RLS: `branches.read` for that branch, or membership).
2. If `includeArchived` is false: exclude archived. Otherwise: include them.
3. If `search` is set: match name or code, case-insensitive.
4. Sort by name, code or created date; page with limit/offset; return `{ rows, total }`.

**Create**
1. If the caller lacks global `branches.create`: `PERMISSION_DENIED`.
2. Normalise and validate code and name (Section 2).
3. Insert. If the code exists: `BRANCH_CODE_TAKEN`.
4. Enqueue `debug.log` (placeholder for real side effects).

**Update (name only)**
1. If the branch doesn't exist: `BRANCH_NOT_FOUND`.
2. If the caller lacks `branches.update` for this branch: `PERMISSION_DENIED`.
3. If archived: `BRANCH_ARCHIVED`.
4. Validate name; update.

**Archive / restore**
1. If the caller lacks global `branches.archive`: `PERMISSION_DENIED`.
2. Set `is_archived`. Otherwise if not found: `BRANCH_NOT_FOUND`.
3. Side effect by design: while archived, tenant-scoped memberships at this branch grant nothing.

## 4. Contract

```sql
list_branches(p_search text?, p_include_archived bool = false, p_limit int = 20,
              p_offset int = 0, p_sort 'name'|'code'|'created_at' = 'name',
              p_dir 'asc'|'desc' = 'asc') → jsonb { rows: Branch[], total: int }   -- invoker, RLS
create_branch(p_code text, p_name text) → Branch            -- definer; global branches.create
update_branch(p_id uuid, p_name text) → Branch              -- definer; branches.update @ p_id
set_branch_archived(p_id uuid, p_archived bool) → Branch    -- definer; global branches.archive
```

| Error code | Field |
|---|---|
| `PERMISSION_DENIED` | |
| `INVALID_BRANCH_CODE` | `code` |
| `BRANCH_CODE_TAKEN` | `code` |
| `INVALID_BRANCH_NAME` | `name` |
| `BRANCH_NOT_FOUND` | |
| `BRANCH_ARCHIVED` | |

Atomic: each write is one transaction. Outbox: `debug.log` on create.
→ `supabase/migrations/20260101000300_branches.sql`

## 5. Outcomes, UI and failures

| Situation | UI |
|---|---|
| Loading | `UI-STATE-LOADING`: skeleton rows |
| No branches | `UI-STATE-EMPTY`: "No branches yet" + Add branch (if permitted) |
| No search results | "No branches match your search" |
| List fails | `UI-STATE-GENERAL-ERROR` with retry |
| No `branches.read` | `UI-STATE-BLOCKED` |
| Create / edit success | Dialog closes; toast "<name> added" / "Changes saved" |
| Field error | Message under the field; dialog stays open |
| Archive | `ConfirmDialog` "Archive branch"; toast "Branch archived" |
| Archive fails | Toast with the error message; dialog stays open |

## 6. Acceptance criteria

| AC | Persona | Action | Expected |
|---|---|---|---|
| AC-01 | No grants | List | Empty, total 0 |
| AC-02 | Head-office admin | Create `' t-tvm '`, "Trivandrum" | Code saved as `T-TVM` |
| AC-03 | Head-office admin | Create duplicate code | `BRANCH_CODE_TAKEN` on `code` |
| AC-04 | Head-office admin | Create code `x` | `INVALID_BRANCH_CODE` on `code` |
| AC-05 | Head-office admin | Archive a branch | It disappears from the default list |
| AC-06 | Head-office admin | List with "Show archived" | Archived branch is listed |
| AC-07 | Branch manager (CLT) | Rename CLT | Saved |
| AC-08 | Branch manager (CLT) | Rename KOC | `PERMISSION_DENIED` |
| AC-09 | Branch manager (CLT) | Create a branch | `PERMISSION_DENIED`; "Add branch" button not shown |

→ `supabase/tests/10_branches.test.sql` (one assertion per AC).
