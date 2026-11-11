# UI registry

UI is the same across platforms, so UI fixes should reach every template.

## Today (one platform)

The canonical UI lives in `platforms/supabase/template/src/components/`:

- `ui/`: shadcn primitives. Never restyled per project; restyle through `src/styles/theme.css`.
- `patterns/`: DataTable, FormModal, ConfirmDialog, TextField, PageHeader, EmptyState, ErrorState.
- `layout/`: AppShell, Sidebar.

## When the second platform template is built

Move `patterns/`, `layout/` and the `rbac/` UI helpers into a private shadcn registry
here, and have every template install from it:

```
shared/ui-registry/
├── registry.json        # shadcn registry manifest
└── registry/
    ├── patterns/data-table.tsx
    └── ...
```

```bash
npx shadcn build                                   # emits public/r/*.json
npx shadcn add https://ui.corbit.internal/r/data-table.json
```

Rules for registry items:

- Platform-neutral: no backend SDK imports. They may import `@/lib/contracts` and `@/rbac`.
- Every item lists its npm `dependencies` and `registryDependencies` (shadcn primitives).
- Premium shadcn blocks go in only if their license allows client projects and
  internal redistribution.
