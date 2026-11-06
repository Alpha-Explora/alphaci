import type { CapabilityOptionValue } from '#kernel/composition/capability-options';
import type { PlatformAppRole } from '#kernel/ports/platform-admin.port';

export { canManageRequirements } from '#kernel/rules/persona-access.rules';

/**
 * Plain functions, not an injectable class: same reasoning as
 * preview-surface.rule.ts — undecorated classes under domain/ get no
 * constructor args from Nest, and none of these rules has a dependency to
 * wire, so a function keeps them pure data in, data out. Every check is an
 * allow-list: an unresolved or future role gets nothing.
 *
 * The permission matrix (docs/design/project-requirements.md, section 4.1):
 *   Creating/editing requirements (canManageRequirements): lead|admin.
 *   Setting an item's Progress (todo / in_progress / done): member|lead|admin.
 *     QA does not write Progress; it verifies.
 *   Setting an item's Verification (pending / passed / failed / blocked /
 *     returned_to_dev): qa|lead|admin. Developers lose it - they report
 *     Progress and QA decides.
 *   Creating a run, signing off, dispatching automation: qa|lead|admin.
 *   Reopening a signed-off run, merging to main: lead|admin only.
 *   request-retest (compatibility alias that sets Progress to done):
 *     member|lead|admin.
 *   Writing test cases (categories and cases under a User story): qa|admin,
 *     plus lead where the deployment's testCaseAuthors is qa-team-and-leads.
 *   Recording a test case's result: the same set. By default the Product
 *     owner reads test cases and their results; it does not change them
 *     (amendment 12).
 *   Accepting a signed-off run's items (pass, or fail back to Development):
 *     lead|admin - the Product owner's check after QA (amendment 12).
 */

/** Setting an item's Progress: the developer track. */
export function canSetProgress(role: PlatformAppRole): boolean {
  return role === 'member' || role === 'lead' || role === 'admin';
}

/** Setting an item's Verification: the QA track. */
export function canSetVerification(role: PlatformAppRole): boolean {
  return role === 'qa' || role === 'lead' || role === 'admin';
}

/**
 * Who writes test cases and records their results on this deployment: the
 * `projects.qa-checklists` option `testCaseAuthors` (ADR-0024). `qa-team`,
 * the default, is ADR-0014 amendments 10 and 12. `qa-team-and-leads` lets
 * the Product owner do both on a deployment that has no QA Team.
 */
export type TestCaseAuthors = CapabilityOptionValue<
  'projects.qa-checklists',
  'testCaseAuthors'
>;

function isTestCaseAuthor(
  role: PlatformAppRole,
  authors: TestCaseAuthors,
): boolean {
  if (role === 'qa' || role === 'admin') return true;
  return role === 'lead' && authors === 'qa-team-and-leads';
}

/**
 * Writing test cases: the QA Team owns how a story is tested, so QA and
 * admins, not Product owners (ADR-0014, amendment 10), unless the deployment
 * names the Product owner an author too.
 */
export function canManageTestCases(
  role: PlatformAppRole,
  authors: TestCaseAuthors,
): boolean {
  return isTestCaseAuthor(role, authors);
}

/** Recording a test case's result: the same authors as writing them. */
export function canRecordTestCaseResults(
  role: PlatformAppRole,
  authors: TestCaseAuthors,
): boolean {
  return isTestCaseAuthor(role, authors);
}

/** The Product owner's acceptance of a signed-off run's items: lead|admin. */
export function canAcceptRunItems(role: PlatformAppRole): boolean {
  return role === 'lead' || role === 'admin';
}

export function canCreateRun(role: PlatformAppRole): boolean {
  return role === 'qa' || role === 'lead' || role === 'admin';
}

/** Setting an item's status TO 'returned_to_dev' — QA feedback. */
export function canSetReturnedToDev(role: PlatformAppRole): boolean {
  return role === 'qa' || role === 'lead' || role === 'admin';
}

/** The request-retest alias, kept for the frontend that predates Progress. */
export function canRequestRetest(role: PlatformAppRole): boolean {
  return role === 'member' || role === 'lead' || role === 'admin';
}

export function canSignOff(role: PlatformAppRole): boolean {
  return role === 'qa' || role === 'lead' || role === 'admin';
}

export function canReopenRun(role: PlatformAppRole): boolean {
  return role === 'lead' || role === 'admin';
}

/** Dispatching the verify workflow's Playwright run: same set as creating a run and signing off. */
export function canDispatchAutomation(role: PlatformAppRole): boolean {
  return role === 'qa' || role === 'lead' || role === 'admin';
}

/** Executing a gated production merge: all known personas; approval is checked separately. */
export function canMergeQaPromotion(role: PlatformAppRole): boolean {
  return (
    role === 'lead' || role === 'admin' || role === 'qa' || role === 'member'
  );
}

/** Attaching screenshot evidence to a run item: the Verification track (qa|lead|admin). */
export function canAddEvidence(role: PlatformAppRole): boolean {
  return role === 'qa' || role === 'lead' || role === 'admin';
}

/**
 * Deleting a human attachment someone else uploaded: lead|admin only. The
 * uploader may always delete their own while the run is open (the service
 * checks the uploader, since a role alone cannot).
 */
export function canRemoveAnyAttachment(role: PlatformAppRole): boolean {
  return role === 'lead' || role === 'admin';
}
