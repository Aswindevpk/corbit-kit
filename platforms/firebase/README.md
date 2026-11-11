# Firebase platform pack (planned)

Build this pack with the first real Firebase project, using the Supabase pack as the
blueprint. Keep the same folder shape so people and agents know where to look:

```
firebase/
├── README.md         # start-here steps
├── template/         # web app (same src/ as Supabase except src/platform + api/) + functions/ + firestore.rules
├── rbac/             # memberships in Firestore + rules helpers + emulator tests
├── patterns/         # callable function template, transaction patterns, outbox
├── integrations/     # msg91/, fcm-push/, razorpay/ as Cloud Functions
└── docs/
```

## How our architecture maps to Firebase

| Concern | Firebase |
|---|---|
| Business rules | Callable Cloud Functions (all writes go through them) |
| Authorization | Security Rules for reads; permission checks inside Functions for writes |
| Invariants | Transactions inside Functions. Firestore has no constraints, so uniqueness and conflicts (e.g. timetable clashes) need explicit transactional checks or lock documents |
| Side effects | Firestore triggers or a Pub/Sub / Cloud Tasks queue |
| Frontend types | Shared TypeScript types package used by functions and web |
| Backend tests | Emulator Suite + `@firebase/rules-unit-testing` |
| RBAC storage | Custom claims for a small role key only (claims are size-limited); membership documents for permissions, read in rules with `get()` (each costs a read) |
| Single session | Revoke refresh tokens on login + a session document checked in rules |

## What stays identical

`src/components`, `src/rbac`, `src/lib`, every feature's `types/ schemas/ components/
forms/ views/ pages/`, `shared/` standards, and `personas.yaml`. Only `src/platform/`
and each feature's `api/` are Firebase-specific.

## Contract checklist for this pack

- `src/platform` exports `AuthProvider`, `useAuth`, `fetchMyPermissions`, `toAppError`,
  `uploadFile`, `getSignedUrl` with the same signatures as the Supabase version.
- Functions throw `HttpsError` with `details: { code, field }`; `toAppError` maps it.
- `fetchMyPermissions` returns the `PermissionSet` shape from `shared/rbac-model/spec.md`.
- RBAC tests cover every row of the project's persona matrix.
