const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  modulePathIgnorePatterns: ['<rootDir>/.next/'],
  collectCoverage: true,
  collectCoverageFrom: [
    '<rootDir>/src/**/*.{ts,tsx}',
    '!<rootDir>/src/**/*.d.ts',
    '!<rootDir>/src/app/**/*.{ts,tsx}',
    // Raw JSX layers are not measured — same policy as the pre-migration
    // components/ exclude. Views render what a ViewModel hands them; the
    // interesting logic lives in view-models/, model/ and data/.
    '!<rootDir>/src/features/**/views/**/*.{ts,tsx}',
    '!<rootDir>/src/shared/layout/**/*.{ts,tsx}',
    '!<rootDir>/src/shared/ui/**/*.{ts,tsx}',
    // The two JSX files whose coverage is actively tracked (they contain
    // real orchestration logic, not just rendering).
    '<rootDir>/src/features/projects/detail/views/project-env-panel.tsx',
    '<rootDir>/src/features/workflows/studio/views/workflow-current-tab.tsx',
  ],
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      // A floor across the measured layers (view-models, model, data, and the
      // two tracked JSX files), enforced by the "Unit tests" step in
      // .github/workflows/boundaries.yml, which runs the whole suite with no
      // exclusions. The numbers date from when that step first ran (345
      // tests, one suite excluded); on 2026-09-25 the suite was 1158 tests and
      // measured 73.35% statements, 74.6% branches, 73.63% functions and
      // 74.95% lines, identically on Windows and on the Linux CI runner. The
      // floor is far below that: ratchet it up rather than let it drift.
      branches: 47,
      functions: 42,
      lines: 50,
      statements: 47,
    },
  },
};

module.exports = createJestConfig(customJestConfig);
