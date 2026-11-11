# RBAC on Supabase

The model is defined in `shared/rbac-model/spec.md`. The implementation is one
migration, `template/supabase/migrations/20260101000100_rbac_core.sql`, used by every
project. Tiers differ only in **which roles you seed**.

## Choosing a tier

```
Does the app have more than "admin" and "everyone else"?
├─ No  → Tier 1
└─ Yes → Do users belong to separate branches / workspaces / organisations?
         ├─ No  → Tier 2
         └─ Yes → Is a user's job the same everywhere they belong (owner/admin/member)?
                  ├─ Yes → Tier 3
                  └─ No  → Do roles need per-action limits (read but not delete/export)?
                           ├─ No  → Tier 4 (module.*)
                           └─ Yes → Tier 5 (module.action)
```

| Tier | Seed file | Example |
|---|---|---|
| 1 | `seeds/tier1-binary.sql` | Consumer app with an admin panel |
| 2 | `seeds/tier2-hierarchy.sql` | Single-campus school, clinic |
| 3 | `seeds/tier3-workspace.sql` | B2B SaaS with workspaces |
| 4 | `seeds/tier4-modular.sql` | Teachwell, multi-branch institutes |
| 5 | `seeds/tier5-action.sql` | Fintech, healthcare, legal |

You can move up a tier later by changing roles; no schema change is needed.

## What the core gives you

| Piece | Purpose |
|---|---|
| `tenants`, `roles`, `memberships`, `profiles` | The model |
| `internal.has_permission(perm, tenant_id)` | Use in every policy and write RPC |
| `internal.is_tenant_member(tenant_id)` | "Belongs here at all" checks |
| `public.get_my_permissions()` | Frontend `PermissionSet` |
| `public.assign_membership` / `revoke_membership` | The only way grants change |
| Session lock | `internal.single_session_enabled()` + `auth.sessions` trigger |
| Column privileges on `profiles` | Users can edit name and avatar only |

## Fixes compared with the original five tier files

These were found reviewing the earlier tier SQL; the core migration already includes them.

1. The `internal` schema had usage revoked from `authenticated`, which makes every
   policy that calls a helper fail. Usage and execute are now granted explicitly.
2. Tier 3's member-roster policy queried its own table (infinite recursion).
   Membership lookups now go through `security definer` helpers.
3. Tier 3 let workspace admins promote themselves or remove the owner. Grants now
   go through `assign_membership`, which checks scope and role flags.
4. Tiers 4/5 used `tenant_id IS NULL` to mean "super admin" with `ON DELETE SET NULL`,
   so deleting a branch promoted its managers to global admins. Scope is now explicit
   and deleting a tenant deletes its memberships.
5. Tier 4 read `tenant_id` from signup metadata, letting users choose their branch.
   Signup now creates a profile only.
6. One tenant per profile could not model a teacher at two campuses. Memberships
   allow many.
7. The session check was only on some policies. It is now inside `has_permission`.
8. No protection stopped a future "edit own profile" policy from allowing role changes.
   Column privileges now allow only `full_name` and `avatar_url`.

## Extending

- **New module**: just use new permission strings (`invoices.read`) in policies and
  RPCs, and add them to the relevant roles.
- **Export**: a dedicated RPC that checks `<module>.export`, writes an audit row
  (`patterns/audit-log.sql`), then returns the data.
- **Parent / observer accounts**: give parents their own auth users and link them to
  students in a `guardian_links` table; policies grant read access through the link.
  Never share student credentials.
- **Workspace self-signup (Tier 3)**: a `create_workspace` RPC that inserts the
  tenant and an `owner` membership for the caller in one transaction.
