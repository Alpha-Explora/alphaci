export type CanonicalRepoShape =
  'standalone' | 'monorepo' | 'microservices' | 'multi-repo';

/**
 * Map a repo shape ID to its canonical form. The catalog (and therefore the
 * FE) uses the short IDs 'mono' and 'multi', while internal flow logic uses
 * 'monorepo' and 'multi-repo'. Accept both so a catalog-driven request never
 * silently falls back to the standalone flow.
 */
export function normalizeRepoShape(
  repoShape: string | null | undefined,
): CanonicalRepoShape {
  switch (repoShape) {
    case 'mono':
    case 'monorepo':
      return 'monorepo';
    case 'multi':
    case 'multi-repo':
      return 'multi-repo';
    case 'microservices':
      return 'microservices';
    default:
      return 'standalone';
  }
}
