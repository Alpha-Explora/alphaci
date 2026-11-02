import path from "node:path";

import oxlint from "eslint-plugin-oxlint";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Second half of `npm run lint`; Oxlint (.oxlintrc.json) runs first.
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".capability-stubs/**",
    "out/**",
    "build/**",
    "coverage/**",
    "next-env.d.ts",
    "coverage/**",
    // Vendored verbatim from the next-feature-architecture skill so the CI
    // gate does not depend on a private repository. Kept byte-identical to
    // upstream to stay re-syncable, so it is not ours to lint.
    "scripts/**",
  ]),
  // Jest config files must use CommonJS require() — disable the rule for them.
  {
    files: ["jest.config.js", "jest.setup.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Oxlint (.oxlintrc.json) now reports unused disable directives
  // (`--report-unused-disable-directives`), since it owns almost every rule
  // they name. ESLint would call those directives unused because the rules are
  // off here. Oxlint cannot tell an ESLint-only rule apart, so a directive for
  // one (none exist) would be reported too: fix the code instead.
  {
    linterOptions: { reportUnusedDisableDirectives: "off" },
  },
  // Dropped on purpose (docs/plans/2026-11-01-monorepo-improvements.md, wave E):
  // these two only validate React Compiler plugin options (moduleTypeProvider,
  // environment, dynamicGating, sources). We pass none and the compiler is not
  // enabled in next.config.ts, so neither can report anything, yet each run
  // compiles every file and took 32 s of a 33 s lint. Oxlint has no equivalent
  // because its compiler port takes no such options.
  {
    rules: {
      "react-hooks/config": "off",
      "react-hooks/gating": "off",
    },
  },
  // Last: turn off every rule .oxlintrc.json runs (the complexity cap, the
  // `_` unused-binding convention and the React Compiler rules live there now),
  // so ESLint keeps only what Oxlint lacks: react/no-deprecated,
  // @next/next/no-location-assign-relative-destination and the
  // react/jsx-uses-* helpers.
  ...(await oxlint.buildFromConfigFile(path.join(import.meta.dirname, ".oxlintrc.json"), {
    withNursery: true,
  })),
]);

export default eslintConfig;
