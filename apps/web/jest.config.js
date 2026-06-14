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
    '!<rootDir>/src/components/**/*.{ts,tsx}',
    '!<rootDir>/src/lib/api/**/*.{ts,tsx}',
    '<rootDir>/src/components/product/project-env-panel.tsx',
    '<rootDir>/src/components/product/workflow-current-tab.tsx',
    '<rootDir>/src/hooks/use-capabilities.ts',
    '<rootDir>/src/hooks/use-project-env-provisioning.ts',
    '<rootDir>/src/lib/api/env-provisioning.ts',
    '<rootDir>/src/lib/api/notifications.ts',
    '<rootDir>/src/lib/api/projects.ts',
    '<rootDir>/src/lib/api/usage.ts',
    '<rootDir>/src/lib/api/workspaces.ts',
  ],
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90,
    },
  },
};

module.exports = createJestConfig(customJestConfig);
