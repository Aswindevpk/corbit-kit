# Naming

| Thing | Convention | Example |
|---|---|---|
| Feature folder | kebab-case, plural noun | `features/fee-payments/` |
| Domain types | PascalCase, camelCase fields | `Branch { isArchived }` |
| Database columns | snake_case | `is_archived` |
| RPCs / API endpoints | verb_noun, snake_case | `list_branches`, `create_branch` |
| Hooks | `use` + Verb + Noun | `useBranchList`, `useCreateBranch` |
| Components | PascalCase, file = component | `BranchTable.tsx` |
| Permission strings | `module.action`, lowercase | `branches.read`, `fees.*` |
| Error codes | UPPER_SNAKE_CASE | `BRANCH_CODE_TAKEN` |
| Query keys | `[feature, scope, params]` | `['branches', 'list', params]` |

Standard actions for permissions: `read`, `create`, `update`, `delete`, `archive`,
`export`, `manage`. Add new verbs to `shared/rbac-model/spec.md` before using them.
