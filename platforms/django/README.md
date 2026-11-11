# Django platform pack (planned)

Build this pack with the first real Django project, using the Supabase pack as the
blueprint. Same folder shape:

```
django/
├── README.md
├── template/
│   ├── backend/      # Django + DRF project
│   └── web/          # same React app; only src/platform + api/ differ
├── rbac/             # models + DRF permission classes + pytest persona tests
├── patterns/         # service/selector templates, Celery outbox
├── integrations/     # msg91/, fcm/, razorpay/ as Django apps
└── docs/
```

## Backend structure (HackSoft Django Styleguide style)

```
backend/apps/<feature>/
├── models.py        # data + DB constraints
├── services.py      # writes: business rules, transactions (the RPC equivalent)
├── selectors.py     # reads: querysets scoped by tenant + permission
├── apis.py          # thin DRF views: parse → service/selector → serialize
├── permissions.py
└── tests/
```

## How our architecture maps to Django

| Concern | Django |
|---|---|
| Business rules | `services.py` functions inside `transaction.atomic()` |
| Authorization | DRF permission classes + tenant-scoped selectors (no RLS, so every queryset must be scoped) |
| Invariants | DB constraints (`UniqueConstraint`, `CheckConstraint`, Postgres `ExclusionConstraint`) |
| Side effects | Outbox model + Celery worker (`transaction.on_commit` to enqueue) |
| Frontend types | drf-spectacular → OpenAPI → Orval (generates typed React Query hooks + Zod) |
| Backend tests | pytest-django |
| Errors | One exception handler returning `{ code, field, message }` |

## What stays identical

Everything in the React app except `src/platform/` and each feature's `api/`, which
wrap the Orval-generated client and keep the same hook names and signatures.
