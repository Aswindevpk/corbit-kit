# RBAC model

One model covers every project, from "admin and user" to multi-branch ERPs with
per-action permissions. The five "tiers" are seeds of this model, not separate code.

## Concepts

| Concept | Meaning |
|---|---|
| **Tenant** | A branch, campus, workspace or organisation. Projects without tenants simply never create one. |
| **Role** | A named set of permission strings, e.g. `accountant` → `["fees.*", "branches.read"]`. |
| **Membership** | Grants one role to one user in one **scope**. |
| **Scope** | `global` (everywhere) or `tenant` (one tenant). Stored explicitly. NULL never means "global". |
| **Permission string** | `module.action`, e.g. `fees.read`. |

A user can hold several memberships: a teacher who works at two campuses has two
tenant-scoped memberships.

## Permission matching

A required permission `fees.read` is granted by any of:

| Granted | Meaning |
|---|---|
| `fees.read` | exact |
| `fees.*` | every action in the module |
| `*.read` | this action in every module (read-only auditor) |
| `*.*` | everything |

…from a membership whose scope covers the resource: a `global` membership covers
every tenant; a `tenant` membership covers only that tenant. Resources that belong to
no tenant can only be covered by `global` memberships.

## Role flags

| Flag | Meaning |
|---|---|
| `is_global_only` | The role may only be granted with global scope (super admin). |
| `assignable_by_tenant` | A tenant-scoped user with `users.manage` may grant this role in their tenant. Otherwise only global managers can. |

## Rules every platform implementation must follow

1. Users never write their own role, scope, or permissions. Grants go through a
   dedicated, permission-checked operation.
2. Deleting a tenant removes its memberships. It never widens anyone's access.
3. Tenant assignment never comes from signup metadata or any client-supplied field.
4. A tenant-scoped manager cannot grant a global membership or an `is_global_only` role.
5. `export` is enforced by a dedicated operation that logs the export. Read access
   alone does not imply it.
6. "Own data" (a student's own records) is not RBAC. Check ownership (`user_id = me`)
   alongside, not instead of, permissions.
7. The frontend receives `PermissionSet` in the shape below and uses it only to hide
   UI. The backend enforces.

## PermissionSet (frontend contract)

```json
{
  "userId": "uuid",
  "grants": [
    { "scope": "global", "tenantId": null, "role": "super_admin", "permissions": ["*.*"] },
    { "scope": "tenant", "tenantId": "uuid", "role": "accountant", "permissions": ["fees.*"] }
  ]
}
```

## Standard actions

`read`, `create`, `update`, `delete`, `archive`, `export`, `manage`.

## Tiers as seeds

| Tier | Seed | Typical project |
|---|---|---|
| 1 Binary | `admin` (`*.*`, global), plain users have no membership | B2C app, blog, store |
| 2 Hierarchy | `super_admin`, `manager` (`*.read/create/update/delete`), `editor` (`*.read/create/update`) | Single school, clinic |
| 3 Workspace | Tenants are workspaces; `owner`, `admin`, `member`, `guest` (`*.read`) tenant-scoped | Slack/Linear-style SaaS |
| 4 Modular | Tenants are branches; department roles use `module.*` | Multi-branch academy, ERP |
| 5 Action | Department roles list exact actions (`crm.read`, `crm.create`) | Fintech, healthcare, legal |
