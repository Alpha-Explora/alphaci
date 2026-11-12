export type AppRole = 'admin' | 'lead' | 'qa' | 'member';

/** A role that may not have loaded yet; every rule refuses it. */
export type MaybeAppRole = AppRole | null | undefined;

export const PIPELINE_BRANCHES: readonly ['dev', 'uat', 'main'];
export const WORKING_BRANCH: 'dev';
export const QA_BRANCH: 'uat';
export const PRODUCTION_BRANCH: 'main';

export function isPipelineBranch(name: string): boolean;
export function canManageProjectLifecycle(role: MaybeAppRole): boolean;
export function canManageEnvVars(role: MaybeAppRole): boolean;
export function canManageHosting(role: MaybeAppRole): boolean;
export function canManageRequirements(role: MaybeAppRole): boolean;
export function canCreateProjectFolder(role: MaybeAppRole): boolean;
export function canCreateRepository(role: MaybeAppRole): boolean;
export function repositoryCreateRequiresProject(role: MaybeAppRole): boolean;
export function isPullRequestRole(role: MaybeAppRole): boolean;
export function isAllowedPullRequestRoute(
  role: MaybeAppRole,
  head: string,
  base: string,
): boolean;

export const SPECIAL_ACCESS: readonly ['qa_release', 'deployment_override'];
export type SpecialAccess = (typeof SPECIAL_ACCESS)[number];
export const OVERRIDE_REASON_MIN_LENGTH: 15;

export function parseSpecialAccess(raw: unknown): SpecialAccess[];
/** A loaded role gives a role; one that has not loaded gives undefined. */
export function actingQaRole<R extends MaybeAppRole>(
  role: R,
  special: readonly SpecialAccess[] | null | undefined,
): R extends AppRole ? AppRole : AppRole | undefined;
export function canOverrideDeployment(
  role: MaybeAppRole,
  special: readonly SpecialAccess[] | null | undefined,
): boolean;
