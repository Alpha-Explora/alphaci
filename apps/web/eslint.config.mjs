import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "coverage/**",
    // Vendored verbatim from the next-feature-architecture skill so the CI
    // gate does not depend on a private repository. Kept byte-identical to
    // upstream to stay re-syncable, so it is not ours to lint — and the lint
    // gate runs --max-warnings=0, which its unused bindings would fail.
    "scripts/**",
  ]),
  // Jest config files must use CommonJS require() — disable the rule for them.
  {
    files: ["jest.config.js", "jest.setup.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Honor the underscore-prefix convention already used in the codebase for
  // intentionally-unused bindings (e.g. stripping framer-motion-only props in
  // test mocks). Without this, those `_`-prefixed names trip no-unused-vars and
  // fail the CI lint gate (which runs with --max-warnings=0).
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
  // Production functions must stay at McCabe ≤ 10. ESLint's complexity metric
  // is the CI lock; `scripts/check-complexity.cjs` is the AST audit used to
  // drive extracts. Views are not exempt — JSX `&&` / ternaries count.
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      complexity: ["error", 10],
    },
  },
]);

export default eslintConfig;
