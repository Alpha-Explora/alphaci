/*
 * Who may do what, by GLOBAL app role ('admin' | 'lead' | 'qa' | 'member').
 *
 * The API enforces these rules and answers 403 when one fails; the web app
 * uses the same functions to decide which controls to offer. One copy, so the
 * two cannot drift: a role added to a list here reaches the gate and the
 * button in the same change.
 *
 * Plain data in, boolean out. Every list is an allow-list: a role added later,
 * or a session whose role has not loaded (null, undefined), is refused until a
 * list names it. Source of truth: docs/design/persona-workflow.md §3.
 *
 * Plain CommonJS with a hand-written index.d.ts, so neither app needs a build
 * step to load it (the API runs compiled CommonJS, Next transpiles it).
 */
'use strict';

/** The pipeline rungs, in promotion order: working, QA, production. */
const PIPELINE_BRANCHES = Object.freeze(['dev', 'uat', 'main']);
const WORKING_BRANCH = 'dev';
const QA_BRANCH = 'uat';
const PRODUCTION_BRANCH = 'main';

const PROJECT_MANAGEMENT_ROLES = ['admin', 'lead'];
const PROJECT_CREATOR_ROLES = ['admin', 'lead'];
const REPOSITORY_CREATOR_ROLES = ['admin', 'member'];
const HOSTING_CONFIG_ROLES = ['admin', 'member'];
const PULL_REQUEST_ROLES = ['admin', 'lead', 'member'];

/** @param {readonly string[]} list @param {string | null | undefined} role */
function named(list, role) {
  return role != null && list.includes(role);
}

/** Pipeline rungs (dev, uat, main); every other branch is a feature branch. */
function isPipelineBranch(name) {
  return PIPELINE_BRANCHES.includes(name);
}

/**
 * Reinstall a deployment target's CI secrets, or disconnect a project (any
 * variant): Product owners ('lead') and admins.
 */
function canManageProjectLifecycle(role) {
  return named(PROJECT_MANAGEMENT_ROLES, role);
}

/** List, provision, validate or delete a project's environment variables: Developers and admins. */
function canManageEnvVars(role) {
  return named(HOSTING_CONFIG_ROLES, role);
}

/** Add, change, verify or remove a project's hosting (targets, custom domains): Developers and admins. */
function canManageHosting(role) {
  return named(HOSTING_CONFIG_ROLES, role);
}

/** Create or edit a Project's QA checklists (requirements): Product owners and admins. */
function canManageRequirements(role) {
  return named(PROJECT_CREATOR_ROLES, role);
}

/** Create a Project (an empty hierarchy delivery project): Product owners and admins. */
function canCreateProjectFolder(role) {
  return named(PROJECT_CREATOR_ROLES, role);
}

/**
 * Create or onboard a repository (create wizard, existing repo setup, hierarchy
 * create, raw GitHub repo create): Developers and admins. Product owners make
 * the Project, developers fill it; QA never does.
 */
function canCreateRepository(role) {
  return named(REPOSITORY_CREATOR_ROLES, role);
}

/**
 * Whether a repository create by `role` must name an existing Project. Only
 * admins may omit it; a Developer files the repository into a Project a
 * Product owner already made.
 */
function repositoryCreateRequiresProject(role) {
  return canCreateRepository(role) && role !== 'admin';
}

/** Who may open or merge a pull request from the workspace at all. */
function isPullRequestRole(role) {
  return named(PULL_REQUEST_ROLES, role);
}

/**
 * Whether `role` may route a workspace pull request `head` -> `base` (open or
 * merge). The production branch is never a base: it is reached only through
 * the promotion flow.
 *
 *   admin, lead: any head into any base except production.
 *   member:      a feature branch into the working branch (feature -> dev), or
 *                the working branch into the QA branch (dev -> uat). Nothing
 *                else, and never an empty head or a branch into itself.
 *   qa, other:   nothing.
 */
function isAllowedPullRequestRoute(role, head, base) {
  if (!isPullRequestRole(role)) return false;
  if (base === PRODUCTION_BRANCH) return false;
  if (role !== 'member') return true;
  if (head === '' || head === base) return false;
  if (base === WORKING_BRANCH) return !isPipelineBranch(head);
  return base === QA_BRANCH && head === WORKING_BRANCH;
}

/*
 * Special access: grants an admin adds to one person on top of their role
 * (identity.app_users.special_access).
 *
 *   qa_release:          act as the QA Team in QA runs (start runs, verify,
 *                        record test results, sign off) and merge to main.
 *                        Never a Product owner power.
 *   deployment_override: merge to main while the promotion gate is blocked,
 *                        with a written reason that is audited and announced.
 *                        Admins always hold it.
 */
const SPECIAL_ACCESS = Object.freeze(['qa_release', 'deployment_override']);

/** The shortest written reason an override must carry. */
const OVERRIDE_REASON_MIN_LENGTH = 15;

/** Known grants only, in canonical order; anything else is dropped. */
function parseSpecialAccess(raw) {
  if (!Array.isArray(raw)) return [];
  return SPECIAL_ACCESS.filter((value) => raw.includes(value));
}

/**
 * The role used for QA-track checks: a Developer holding qa_release acts as
 * QA; every other role is unchanged. A role that has not loaded stays
 * undefined. Developer-track checks keep reading the real role.
 */
function actingQaRole(role, special) {
  if (role == null) return undefined;
  return role === 'member' && (special ?? []).includes('qa_release')
    ? 'qa'
    : role;
}

/** Whether the person may merge to main past a blocked promotion gate. */
function canOverrideDeployment(role, special) {
  return role === 'admin' || (special ?? []).includes('deployment_override');
}

module.exports = Object.freeze({
  PIPELINE_BRANCHES,
  WORKING_BRANCH,
  QA_BRANCH,
  PRODUCTION_BRANCH,
  isPipelineBranch,
  canManageProjectLifecycle,
  canManageEnvVars,
  canManageHosting,
  canManageRequirements,
  canCreateProjectFolder,
  canCreateRepository,
  repositoryCreateRequiresProject,
  isPullRequestRole,
  isAllowedPullRequestRoute,
  SPECIAL_ACCESS,
  OVERRIDE_REASON_MIN_LENGTH,
  parseSpecialAccess,
  actingQaRole,
  canOverrideDeployment,
});
