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
