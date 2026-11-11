# Feature anatomy

Every feature lives in `src/features/<feature>/` and has the same shape on every platform.

```
src/features/branches/
├── types/          # Domain types (Branch, BranchStatus). Platform-neutral. camelCase.
├── schemas/        # Zod schemas for forms. UX validation only; the backend re-validates.
├── messages.ts     # User-facing text for this feature's error codes.
├── components/     # Dumb pieces: tables, badges, cards. Props in, callbacks out.
├── forms/          # React Hook Form + Zod. Emits onSubmit(values). Shows field errors.
├── views/          # Composes components + forms into a screen body. Still dumb.
├── pages/          # Wiring: calls api hooks, holds list params, shows toasts, renders a view.
├── api/            # THE ONLY PLATFORM-SPECIFIC FOLDER.
│   ├── <f>.keys.ts        # React Query keys
│   ├── <f>.queries.ts     # useXList(), useX()
│   ├── <f>.mutations.ts   # useCreateX(), useUpdateX()
│   └── <f>.mappers.ts     # backend row → domain type (validated with Zod)
└── index.ts        # Public exports. Other code imports the feature only from here.
```

## Dependency rules (enforced by ESLint)

```
components/ forms/ views/  ──►  types/, schemas/, messages.ts, @/components/*, @/rbac, @/lib
pages/                     ──►  everything above + api/
api/                       ──►  @/platform, types/, schemas/
other features             ──►  only '@/features/<f>' (its index.ts)
```

- `components/`, `forms/`, `views/` never import `api/`, `@/platform`, a backend SDK,
  or generated database types.
- Features never use raw `<button> <input> <select> <textarea> <table>`. Use
  `@/components/ui` primitives or `@/components/patterns`.

## The rule that makes backend migration cheap

Dumb UI only ever sees **domain types** from `types/`. The `api/` mappers convert
whatever the backend returns (snake_case rows, Firestore docs, DRF JSON) into those
types, and validate it at runtime with Zod. When the backend changes, only the
mappers and the fetch calls change.

## Hook contract (same on every platform)

- List hooks take `ListParams` and return `ListResult<T>` = `{ rows: T[]; total: number }`.
- Detail hooks return `T`.
- Mutations take form values (or `{ id, values }`) and return the domain type.
- Every error that leaves `api/` is an `AppError { code, field?, message }`.
  `field` uses the **form field name**, so forms can attach it to the right input.

## What a migration touches

| Layer | Supabase → Firebase/Django |
|---|---|
| components / forms / views / pages | unchanged |
| types / schemas / messages | unchanged |
| api/ | rewritten (keep hook names and signatures) |
| src/platform/ | swapped for the new platform's version |
| backend logic | regenerated from the same Logic Docs |
