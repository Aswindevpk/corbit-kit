// Architecture rules live here, not only in AGENTS.md: the agent can ignore a
// sentence, it cannot ignore a failing lint. See shared/standards/feature-anatomy.md.
import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const crossFeature = {
  group: ['@/features/*/*'],
  message: 'Import another feature only through its index.ts: "@/features/<name>".',
};
const backendInDumbUi = [
  { group: ['../api', '../api/*', '**/api/*'], message: 'Dumb UI must not import api/. Wire data in pages/.' },
  { group: ['@supabase/*', '@/platform', '@/platform/*'], message: 'Dumb UI must not touch the platform.' },
  { group: ['@/types/database.types'], message: 'Use domain types from ../types, never generated DB types.' },
];
const backendInPages = [
  { group: ['@supabase/*', '@/platform/client'], message: 'Pages call api/ hooks, not the client.' },
  { group: ['@/types/database.types'], message: 'Use domain types from ../types.' },
];
const rawElement = (element, use) => ({ element, message: `Use ${use} instead of raw <${element}>.` });

export default tseslint.config(
  { ignores: ['dist', 'supabase', 'src/types/database.types.ts'] },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { react, 'react-hooks': reactHooks },
    settings: { react: { version: 'detect' } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // A warning, not an error: split by responsibility, never by line count.
      'max-lines': ['warn', { max: 250, skipBlankLines: true, skipComments: true }],
      'no-restricted-imports': ['error', { patterns: [crossFeature] }],
    },
  },

  // shadcn primitives are vendored code.
  { files: ['src/components/ui/**'], rules: { 'max-lines': 'off' } },

  // Dumb layers: no data access of any kind.
  {
    files: ['src/features/*/components/**', 'src/features/*/forms/**', 'src/features/*/views/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [crossFeature, ...backendInDumbUi] }] },
  },

  // Pages wire api/ hooks to views; they never call the client directly.
  {
    files: ['src/features/*/pages/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [crossFeature, ...backendInPages] }] },
  },

  // Features compose primitives and patterns, never raw interactive HTML.
  {
    files: ['src/features/**/*.tsx'],
    rules: {
      'react/forbid-elements': ['error', {
        forbid: [
          rawElement('button', '<Button> from @/components/ui/button'),
          rawElement('input', '<Input> or <TextField>'),
          rawElement('select', 'a ui select primitive'),
          rawElement('textarea', 'a ui textarea primitive'),
          rawElement('table', '<DataTable> from @/components/patterns'),
          { element: 'form', message: 'Forms belong in forms/.' },
        ],
      }],
    },
  },
  {
    files: ['src/features/*/forms/**'],
    rules: {
      'react/forbid-elements': ['error', {
        forbid: [
          rawElement('button', '<Button>'),
          rawElement('input', '<Input> or <TextField>'),
          rawElement('select', 'a ui select primitive'),
          rawElement('textarea', 'a ui textarea primitive'),
          rawElement('table', '<DataTable>'),
        ],
      }],
    },
  },
);
