import type { ServiceRuntimeContract } from '#kernel/ports/deployment-runtime.port';

/**
 * The stacks the scaffold can emit.
 *
 * Declared in the scaffold registry so scaffold generation and project
 * lifecycle code can read it without depending on the file builder.
 */
export type CanonicalStack =
  'nestjs' | 'nodejs' | 'nextjs' | 'react' | 'dotnet';

/**
 * What each generated app serves in its container: the port and the health
 * path. This table is the source of truth. The Dockerfiles, the listen
 * settings, the health routes and the docker-compose ports read from it, and
 * on-prem uses it as the default assignment for a project AlphaCI scaffolded.
 * `service-runtime-contract.spec.ts` builds every scaffold and fails if one of
 * them serves something else.
 *
 * - nestjs: `ENV PORT`, `app.listen(process.env.PORT)` and a `/health` controller.
 * - nodejs: `ENV PORT` and `EXPOSE`. The starter has no HTTP server yet; the
 *   code a developer adds should listen on `PORT` and answer `/health`, the
 *   path every backend release is probed on.
 * - dotnet: `ASPNETCORE_URLS` and `MapGet("/health")`.
 * - nextjs: `next start` on `PORT`; the starter page answers `/`.
 * - react: nginx listens on the port and serves `index.html` at `/`.
 */
export const SCAFFOLD_RUNTIME_CONTRACTS = {
  nestjs: { slot: 'backend', containerPort: 3000, healthPath: '/health' },
  nodejs: { slot: 'backend', containerPort: 3000, healthPath: '/health' },
  dotnet: { slot: 'backend', containerPort: 8080, healthPath: '/health' },
  nextjs: { slot: 'frontend', containerPort: 3000, healthPath: '/' },
  react: { slot: 'frontend', containerPort: 8080, healthPath: '/' },
} as const satisfies Readonly<Record<CanonicalStack, ServiceRuntimeContract>>;

/**
 * Accept legacy FE/API project type IDs as well as catalog stack keys. Older
 * saved requests and tests still use values like 'nestjs-api' and 'react-app',
 * but the scaffold needs canonical stack names to emit the right file tree.
 *
 * Two different things used to share one fallback, and only one of them was
 * benign:
 *
 *   nullish  → a project with no recorded stack, which is every project
 *              predating the catalog. Defaulting these to nodejs is correct.
 *   unknown  → a stack that was explicitly asked for and is not supported.
 *              Defaulting these produced a repository scaffolded as Node —
 *              package.json, tsconfig, ESLint, a Node Dockerfile — for someone
 *              who asked for something else, with nothing anywhere reporting
 *              the substitution. The pipeline then ran `npm ci` against it and
 *              failed for a reason unrelated to the actual mistake.
 *
 * The same reasoning applies to repo shapes: unknown catalog-driven requests
 * must not silently fall back to the standalone flow.
 */
export function normalizeProjectStack(
  stack: string | null | undefined,
): CanonicalStack {
  const normalized = (stack ?? '').trim().toLowerCase();

  if (normalized === '') return 'nodejs';
  if (normalized.includes('dotnet')) return 'dotnet';
  if (normalized.includes('next')) return 'nextjs';
  if (normalized.includes('react') && !normalized.includes('react-native')) {
    return 'react';
  }
  if (normalized.includes('nest')) return 'nestjs';
  if (normalized.includes('node')) return 'nodejs';

  throw new Error(
    `Unsupported project stack '${stack}'. The scaffold can emit nextjs, react, nestjs, nodejs or dotnet; a stack outside that set needs a scaffold before it can be provisioned.`,
  );
}

/**
 * The runtime contract of the app scaffolded for a project type: its container
 * port and health path. Null when there is no project type (a repository
 * AlphaCI did not scaffold) or the type has no scaffold, so the caller keeps
 * its own default instead of guessing one.
 */
export function scaffoldRuntimeContract(
  projectTypeId: string | null | undefined,
): ServiceRuntimeContract | null {
  if (!projectTypeId?.trim()) return null;
  try {
    return SCAFFOLD_RUNTIME_CONTRACTS[normalizeProjectStack(projectTypeId)];
  } catch {
    return null;
  }
}
