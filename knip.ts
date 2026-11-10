import type { KnipConfig } from 'knip';

// Unused dependencies, undeclared dependencies, unknown binaries and files that
// nothing reaches fail CI (`npm run check:unused`). Each exception below says
// why knip cannot see the use.
const config: KnipConfig = {
  // System tools the API specs and packaging scripts call, not npm packages.
  ignoreBinaries: ['jq', 'openssl', 'dpkg-deb'],
  // Follow CSS @import so a package imported only from a stylesheet
  // (`@import "tailwindcss"`) counts as used.
  compilers: {
    css: (text: string) =>
      [...text.matchAll(/@import\s+["']([^"']+)["']/g)]
        .map(([, specifier]) => `import "${specifier}";`)
        .join('\n'),
  },
  workspaces: {
    '.': {
      entry: ['scripts/*.{cjs,mjs}'],
      // Scripts that built dated planning artifacts, run by hand when someone
      // regenerates them. Nothing imports them.
      ignore: ['docs/plans/**'],
    },
    'apps/api': {
      entry: [
        'src/main.ts',
        'src/cli/alphaci-ctl.ts',
        'src/scripts/*.ts',
        'scripts/**/*.{ts,cjs,mjs}',
        // The public boundary of each context and subsystem: other code is
        // meant to import through these, so they are entries, not dead files.
        'src/modules/**/index.ts',
        'src/packs/**/index.ts',
        // Loaded by tests/e2e/jest-e2e.json (testRegex, globalSetup,
        // globalTeardown), a config knip cannot read.
        'tests/e2e/**/*.e2e-spec.ts',
        'tests/e2e/support/*.ts',
      ],
      project: ['src/**/*.ts', 'scripts/**/*.{ts,cjs,mjs}', 'tests/**/*.ts'],
      ignoreDependencies: [
        // Not imported: the API generates this package. The dependency is what
        // makes Turbo build and mark the API affected together with it.
        '@alphaci/capability-catalog',
        // Loaded by `oxlint --type-aware`, not imported.
        'oxlint-tsgolint',
      ],
    },
    'apps/web': {
      entry: [
        'scripts/**/*.{cjs,mjs}',
        // Each feature's barrel is its public boundary.
        'src/features/*/index.ts',
        // The full-stack suite has its own Playwright config, outside the
        // default location knip looks in.
        'tests/fullstack/*.{ts,mjs}',
      ],
      project: ['src/**/*.{ts,tsx,css}', 'scripts/**/*.{cjs,mjs}', 'tests/**/*.{ts,tsx}'],
      // k6 scripts: they run in the k6 runtime, where `k6/*` is built in.
      ignore: ['tests/performance/**'],
      // knip cannot load jest.config.js (next/jest loads next.config.ts through
      // Next's own loader), so the test entries are listed here.
      jest: {
        config: [],
        entry: ['tests/**/*.test.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}', 'jest.setup.js'],
      },
      // Named as `testEnvironment` in jest.config.js, which knip cannot load.
      ignoreDependencies: ['jest-environment-jsdom'],
    },
    'packages/*': {},
  },
};

export default config;
