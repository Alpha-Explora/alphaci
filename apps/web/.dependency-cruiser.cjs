/**
 * Feature boundary + MVVM enforcement.
 *
 * The MVVM split is only real if crossing a layer fails the build. A `ui/`
 * file that fetches its own data is not a View, whatever the folder is called.
 *
 *   npm run boundaries        # fails on NEW violations only
 *   npm run boundaries:all    # shows everything, including the legacy baseline
 */
module.exports = {
  forbidden: [
    {
      name: 'view-must-not-fetch',
      severity: 'error',
      comment:
        'A View renders what a ViewModel gives it. If ui/ imports api/, the ' +
        'component owns its own data fetching and the layer boundary is ' +
        'fictional. Move the call into model/ and pass the result down as props.',
      from: { path: '^src/features/([^/]+)/ui/' },
      to: { path: '^src/features/[^/]+/api/' },
    },
    {
      name: 'no-deep-feature-imports',
      severity: 'error',
      comment:
        "Import a feature through its index.ts, never one of its internals. " +
        'This is what lets a feature be rewritten without touching consumers.',
      from: { path: '^src/features/([^/]+)/' },
      to: {
        path: '^src/features/([^/]+)/(?!index\\.ts$).+',
        pathNot: ['^src/features/$1/'],
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
        path: '^src/features/[^/]+/(?!index\\.ts$).+',
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
