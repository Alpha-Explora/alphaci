import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

jest.setTimeout(120_000);

describe('module boundary policy', () => {
  const repositoryRoot = resolve(__dirname, '../..');
  const configPath = resolve(repositoryRoot, '.dependency-cruiser.cjs');

  it('keeps the required rules enabled in the dependency-cruiser config', () => {
    const config: { forbidden: Array<{ name: string }> } = require(configPath);

    const ruleNames = config.forbidden.map((rule) => rule.name);
    expect(ruleNames).toContain('no-deep-module-imports');
    expect(ruleNames).toContain('no-cross-module-deep-imports');
    expect(ruleNames).toContain('kernel-must-not-know-features');
    expect(ruleNames).toContain('no-circular');
    expect(ruleNames).toContain('deployments-domain-is-framework-free');
    expect(ruleNames).toContain('deployments-api-cannot-reach-infrastructure');
    expect(ruleNames).toContain('deployment-providers-are-isolated');
    expect(ruleNames).toContain('no-test-imports-in-src');
  });

  it('passes dependency-cruiser with zero violations', () => {
    // Runs the actual analysis against source code. If a violation exists,
    // execSync throws and this test fails with depcruise's own output.
    // Invoke the local depcruise binary directly (not via npm) so the gate
    // works on machines where npm is not on PATH.
    const nodeCmd = process.execPath;
    // npm workspaces may hoist the package to the monorepo root, and its
    // exports hide package.json from require, so find the package directory
    // on Node's lookup path and read its declared `depcruise` bin.
    const packageDir = (require.resolve.paths('dependency-cruiser') ?? [])
      .map((dir) => resolve(dir, 'dependency-cruiser'))
      .find((candidate) => existsSync(resolve(candidate, 'package.json')));
    if (!packageDir) throw new Error('dependency-cruiser is not installed');
    const { bin } = JSON.parse(
      readFileSync(resolve(packageDir, 'package.json'), 'utf8'),
    ) as { bin: Record<string, string> };
    const depcruiseJs = resolve(packageDir, bin['depcruise']!);
    try {
      const quote = process.platform === 'win32' ? '"' : "'";
      const q = (value: string) => `${quote}${value}${quote}`;
      execSync(
        `${q(nodeCmd)} ${q(depcruiseJs)} src tests --config ${q(configPath)}`,
        {
          cwd: repositoryRoot,
          encoding: 'utf8',
          timeout: 120_000,
          stdio: 'pipe',
        },
      );
      // Reaching here means exit code 0 (zero violations).
    } catch (error: unknown) {
      const output =
        error instanceof Error && 'stdout' in error
          ? String((error as { stdout?: unknown }).stdout)
          : '';
      throw new Error(
        `dependency-cruiser found violations:\n${output || String(error)}`,
        { cause: error },
      );
    }
  });

  it('keeps the known baseline structurally valid', () => {
    const baseline = JSON.parse(
      readFileSync(
        resolve(repositoryRoot, '.dependency-cruiser-known-violations.json'),
        'utf8',
      ),
    ) as Array<{ from: string; to?: string; rule?: { name?: string } }>;

    expect(Array.isArray(baseline)).toBe(true);
    expect(baseline.length).toBe(0);
  });
});
