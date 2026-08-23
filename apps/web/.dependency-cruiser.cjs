/**
 * Feature boundary + MVVM enforcement.
 *
 * The MVVM split is only real if crossing a layer fails the build. A `ui/`
 * file that fetches its own data is not a View, whatever the folder is called.
 *
 *   npm run boundaries
 *
 * There is no known-violations baseline. There was one — it grandfathered a
 * cycle through the hierarchy page shell and app-nav's direct reach into the
 * notifications repository. Both are fixed, so the ratchet has nothing left to
 * hold and the check is simply strict. Do not reintroduce the baseline to land
 * a violation; fix the edge instead.
 */
module.exports = {
  forbidden: [
    {
      name: 'views-must-not-fetch',
      severity: 'error',
      comment:
        'A View renders what a ViewModel gives it. If views/ imports data/ at ' +
        'runtime, the component owns its own data fetching and the layer ' +
        'boundary is fictional. Move the call into view-models/ and pass the result ' +
        'down as props.\n' +
        'Type-only imports are exempt: they are erased at compile time and ' +
        'carry no coupling — a View legitimately needs the shape of what it ' +
        'renders. It is the fetching that must live in the ViewModel.',
      from: { path: '^src/features/[^/]+/[^/]+/views/' },
      to: {
        path: '^src/features/[^/]+/(data|[^/]+/data)/',
        dependencyTypesNot: ['type-only'],
      },
    },
    {
      name: 'no-deep-feature-imports',
      severity: 'error',
      comment:
        "Import a feature through its index.ts, never one of its internals. " +
        'This is what lets a feature be rewritten without touching consumers.',
      from: { path: '^src/features/([^/]+)/' },
      to: {
        path: '^src/features/',
        pathNot: [
          // Within your own domain, reach freely — the skill sanctions
          // features/<domain>/{model,data} as the share point between actions.
          '^src/features/$1/',
          '^src/features/[^/]+/index\\.ts$',
          '^src/features/[^/]+/[^/]+/index\\.ts$',
        ],
      },
    },
    {
      name: 'routes-compose-only',
      severity: 'error',
      comment:
        'app/ is a routing table. It may import a feature\'s public API and ' +
        'shared/, nothing deeper. Business logic belongs in a feature.',
      from: { path: '^src/app/' },
      to: {
        path: '^src/features/',
        // Legal targets are barrels only: the domain barrel, or an
        // action-slice barrel under features/<domain>/<action>/index.ts.
        pathNot: [
          '^src/features/[^/]+/index\\.ts$',
          '^src/features/[^/]+/[^/]+/index\\.ts$',
        ],
      },
    },
    {
      name: 'components-barrel-only',
      severity: 'error',
      comment:
        'components/ is the pre-migration layout: 16k lines that no feature ' +
        'owns. It may consume a feature through a barrel, never reach past ' +
        'one. Without this rule the largest consumer surface in the repo is ' +
        'the one place a feature\'s internals are unguarded — routes and other ' +
        'features are already covered, components/ was the blind spot.\n' +
        'app-nav used to reach straight into the notifications repository to ' +
        'dodge a cycle: the inbox view imports AppNav, so app-nav importing ' +
        'the inbox barrel closed a loop. The fix was a features/notifications/ ' +
        'summary slice the shell can consume without touching the inbox — not ' +
        'a wider rule.',
      from: { path: '^src/components/' },
      to: {
        path: '^src/features/',
        pathNot: [
          '^src/features/[^/]+/index\\.ts$',
          '^src/features/[^/]+/[^/]+/index\\.ts$',
        ],
      },
    },
    {
      name: 'shared-must-not-know-features',
      severity: 'error',
      comment:
        'shared/ sits below every feature. A primitive that imports a feature ' +
        'cannot be reused by a different one.',
      from: { path: '^src/shared/' },
      to: { path: '^src/features/' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'A cycle means neither side can be understood or moved alone.',
      from: {},
      to: { circular: true },
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['\\.test\\.tsx?$', '^tests/'] },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      extensions: ['.ts', '.tsx', '.js', '.jsx'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
    reporterOptions: {
      dot: { collapsePattern: '^src/(features|shared)/[^/]+' },
    },
  },
};
