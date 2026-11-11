# components/ui

shadcn primitives (new-york style, Tailwind v4). Vendored code:

- Never restyle these per project. Change `src/styles/theme.css` instead.
- Add more with `npx shadcn@latest add <component>`; it reads `components.json`.
- To refresh one to upstream: `npx shadcn@latest add <component> --overwrite`,
  then re-apply the two local additions: `Button` has `isLoading`, `Badge` has
  `success` and `warning` variants.
