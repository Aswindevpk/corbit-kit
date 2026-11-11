# Error-code registry

Error codes are the contract between backend and UI. They are the same strings on
every platform, so the UI's messages never change when the backend does.

## Format

- `UPPER_SNAKE_CASE`, prefixed by entity for domain errors: `BRANCH_CODE_TAKEN`.
- Backends attach an optional `field`: the **form field name** the error belongs to
  (`code`, `name`), not the database column.
- The UI maps codes to text in `src/lib/error-messages.ts` (core) and each feature's
  `messages.ts` (domain). Unknown codes fall back to a generic message.

## Core codes (every platform must produce these)

| Code | Meaning |
|---|---|
| `PERMISSION_DENIED` | Authenticated, but not allowed to do this |
| `NOT_AUTHENTICATED` | No valid session |
| `SESSION_REPLACED` | Signed in on another device (single-session projects) |
| `NOT_FOUND` | Generic not found (prefer `<ENTITY>_NOT_FOUND`) |
| `VALIDATION_FAILED` | Input failed validation; `field` says where |
| `DUPLICATE` | Unique constraint hit without a more specific code |
| `NETWORK_ERROR` | Request never reached the server |
| `UNKNOWN` | Anything unmapped. Log it; it means a code is missing |

## Domain codes

Each feature's Logic Doc (Section 5, failure table) lists its codes. Add them here
when a project adopts them, so later projects can reuse the same names.

| Code | Field | Feature |
|---|---|---|
| `BRANCH_NOT_FOUND` | | branches |
| `BRANCH_CODE_TAKEN` | `code` | branches |
| `INVALID_BRANCH_CODE` | `code` | branches |
| `INVALID_BRANCH_NAME` | `name` | branches |
| `BRANCH_ARCHIVED` | | branches |
| `ROLE_NOT_FOUND` | `role` | rbac |
| `ROLE_REQUIRES_GLOBAL_SCOPE` | `role` | rbac |
| `SELF_REVOKE_NOT_ALLOWED` | | rbac |
