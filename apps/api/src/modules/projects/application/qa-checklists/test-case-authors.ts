import type { CapabilityOptionsPort } from '#kernel/composition/capability-options.port.js';
import type { TestCaseAuthors } from '../../domain/qa-run-access.rules';

/**
 * This deployment's test case authors (ADR-0023). A service built without
 * the options port, as unit tests build them, gets the catalog default,
 * which is the rule every deployment had before the option existed.
 */
export function testCaseAuthorsOf(
  options: CapabilityOptionsPort | undefined,
): TestCaseAuthors {
  return (
    options?.value('projects.qa-checklists', 'testCaseAuthors') ?? 'qa-team'
  );
}
