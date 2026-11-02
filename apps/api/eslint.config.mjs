// @ts-check
// Second half of `npm run lint`. Oxlint (.oxlintrc.json) runs first and owns
// every rule it supports, type-aware ones included. The presets below still
// define the rule set; eslint-plugin-oxlint, last, turns off everything
// .oxlintrc.json runs, which leaves @typescript-eslint/consistent-type-imports
// and no-octal here. Formatting is `npm run format:check` (Prettier), not ESLint.
import path from 'node:path';

import eslint from '@eslint/js';
import oxlint from 'eslint-plugin-oxlint';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    // `npm run lint` covers *.ts only, as before; .oxlintrc.json matches.
    ignores: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
  eslint.configs.recommended,
  // No type information here: no rule left in ESLint needs it. If a
  // type-aware rule ever stops being covered by .oxlintrc.json, ESLint fails
  // loudly ("requires type information") instead of dropping it.
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      // consistent-type-imports used to read these from tsconfig.json. With
      // both on it skips files with decorators, so it never asks for
      // `import type` on a constructor parameter Nest reads at runtime.
      parserOptions: {
        emitDecoratorMetadata: true,
        experimentalDecorators: true,
      },
    },
  },
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports' },
      ],
    },
  },
  {
    files: ['**/*.spec.ts'],
    rules: {
      '@typescript-eslint/consistent-type-imports': 'off',
    },
  },
  ...(await oxlint.buildFromConfigFile(
    path.join(import.meta.dirname, '.oxlintrc.json'),
    { typeAware: true, withNursery: true },
  )),
);
