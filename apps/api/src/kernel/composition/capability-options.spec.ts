import type { CapabilityRecord } from './capability-record.types.js';
import { capabilityOptionsFrom } from './capability-options.port.js';
import { parseCapabilityOptions } from './capability-options.js';

/** A registry fixture: options are the point here, not the shipped catalog. */
const registry: readonly CapabilityRecord[] = [
  {
    key: 'projects.qa-checklists',
    context: 'projects',
    description: 'QA checklists.',
    maturity: 'limited',
    configuration: 'qaChecklists.enabled',
    configurationFlags: ['qaChecklists.enabled'],
    requires: [],
    options: [
      {
        key: 'reviewMode',
        env: 'QA_REVIEW_MODE',
        description: 'Who reviews.',
        values: ['standard', 'strict'],
        default: 'standard',
      },
    ],
  },
  {
    key: 'identity.workspaces',
    context: 'identity-access',
    description: 'Workspaces.',
    maturity: 'stable',
    configuration: 'workspaces.enabled',
    configurationFlags: ['workspaces.enabled'],
    requires: [],
  },
];

describe('parseCapabilityOptions', () => {
  it('resolves the default when the variable is unset or blank', () => {
    expect(parseCapabilityOptions({}, registry)).toEqual({
      'projects.qa-checklists': { reviewMode: 'standard' },
    });
    expect(parseCapabilityOptions({ QA_REVIEW_MODE: '  ' }, registry)).toEqual({
      'projects.qa-checklists': { reviewMode: 'standard' },
    });
  });

  it('reads a declared value, ignoring case and surrounding space', () => {
    expect(
      parseCapabilityOptions({ QA_REVIEW_MODE: ' Strict ' }, registry),
    ).toEqual({ 'projects.qa-checklists': { reviewMode: 'strict' } });
  });

  it('stops the boot on a value the option does not declare', () => {
    expect(() =>
      parseCapabilityOptions({ QA_REVIEW_MODE: 'lenient' }, registry),
    ).toThrow(
      "[config] Invalid QA_REVIEW_MODE: 'lenient'. Allowed values: standard, strict. Default when unset: standard.",
    );
  });

  it('leaves capabilities without options out', () => {
    expect(parseCapabilityOptions({}, registry)).not.toHaveProperty(
      'identity.workspaces',
    );
  });

  it('resolves the shipped registry from an empty environment', () => {
    expect(() => parseCapabilityOptions({})).not.toThrow();
  });
});

describe('capabilityOptionsFrom', () => {
  const options = capabilityOptionsFrom({
    'projects.qa-checklists': { reviewMode: 'strict' },
  });
  // The shipped registry declares no option yet, so the typed accessor is
  // exercised through a widened view of the same port.
  const value = options.value as (capability: string, option: string) => string;

  it('returns the resolved value', () => {
    expect(value('projects.qa-checklists', 'reviewMode')).toBe('strict');
  });

  it('throws for an option that was never declared', () => {
    expect(() => value('identity.workspaces', 'reviewMode')).toThrow(
      "[composition] 'identity.workspaces' declares no option 'reviewMode'.",
    );
  });
});
