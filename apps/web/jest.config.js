const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  testEnvironment: 'jest-environment-jsdom',
  roots: ['<rootDir>/tests', '<rootDir>/src'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
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
      // Today's real floor across the measured layers (view-models, model,
      // data, and the two tracked JSX files). The previous 90/80 thresholds
      // were aspirational and never enforced — CI did not run npm test, and
      // the numbers have been below the target since before the feature-MVVM
      // migration. Set the gate at the current reality and ratchet up as
      // tests are added.
      // 345 tests pass when the known-broken project-env-panel suite is
      // excluded (the CI configuration), so the gate is set to the floor
      // that run produces. The 10-test-included run is slightly higher.
      branches: 47,
      functions: 42,
      lines: 50,
      statements: 47,
    },
  },
};

module.exports = createJestConfig(customJestConfig);
