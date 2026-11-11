# UI states

Logic Docs reference these IDs in Section 5. The patterns in `@/components/patterns`
implement them, so features don't re-invent them.

| ID | Where it's implemented | Behaviour |
|---|---|---|
| `UI-STATE-LOADING` | `DataTable` skeleton rows, `Button isLoading` | Show structure, not spinners, for lists |
| `UI-STATE-EMPTY` | `EmptyState` (DataTable `empty` prop) | Say what's missing and offer the action that fixes it |
| `UI-STATE-GENERAL-ERROR` | `ErrorState` with retry; toast for mutations | Say what failed and what to do next |
| `UI-STATE-BLOCKED` | `RequirePermission` → `ErrorState` | Explain the user lacks access; no retry |
| `UI-STATE-OFFLINE-NO-DATA` | `ErrorState` with `NETWORK_ERROR` | Ask to check the connection; retry |
| `UI-STATE-OFFLINE-SLOW-NETWORK` | React Query `isFetching` + kept previous data | Keep old data visible while refetching |
