import {
  actingQaRole,
  canOverrideDeployment,
  parseSpecialAccess,
} from './special-access.rules';

describe('special-access rules', () => {
  it('keeps known grants only, in canonical order', () => {
    expect(
      parseSpecialAccess(['deployment_override', 'po', 'qa_release']),
    ).toEqual(['qa_release', 'deployment_override']);
    expect(parseSpecialAccess(null)).toEqual([]);
  });

  it('lets a Developer with qa_release act as QA, nobody else changes', () => {
    expect(actingQaRole('member', ['qa_release'])).toBe('qa');
    expect(actingQaRole('member', [])).toBe('member');
    expect(actingQaRole('lead', ['qa_release'])).toBe('lead');
    expect(actingQaRole('admin', ['qa_release'])).toBe('admin');
    expect(actingQaRole('member', ['deployment_override'])).toBe('member');
  });

  it('grants override to admins and deployment_override holders only', () => {
    expect(canOverrideDeployment('admin', [])).toBe(true);
    expect(canOverrideDeployment('lead', ['deployment_override'])).toBe(true);
    expect(canOverrideDeployment('lead', [])).toBe(false);
    expect(canOverrideDeployment('qa', ['qa_release'])).toBe(false);
  });
});
