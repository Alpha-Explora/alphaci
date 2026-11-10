import {
  canOfferOverride,
  normalizePromotionStatus,
  overrideErrorMessage,
  overrideReasonProblem,
} from '@/features/checklists/model/qa-promotion-rules';
import { visibleProjectDetailTabs } from '@/features/projects/detail/model/project-detail-tab-rules';
import {
  buildSetupExistingRepoPayload,
  existingRepoFiling,
} from '@/features/workflows/studio/model/studio-command-payloads';
import { attachExistingRepositoryHref } from '@/features/groups/model/add-repository-rules';
import { actingQaRole, parseSpecialAccess } from '@/shared/api/special-access';

describe('special access', () => {
  it('keeps known grants only', () => {
    expect(
      parseSpecialAccess(['deployment_override', 'po', 'qa_release']),
    ).toEqual(['qa_release', 'deployment_override']);
    expect(parseSpecialAccess(undefined)).toEqual([]);
  });

  it('lets a Developer with qa_release act as QA, nobody else changes', () => {
    expect(actingQaRole('member', ['qa_release'])).toBe('qa');
    expect(actingQaRole('member', [])).toBe('member');
    expect(actingQaRole('lead', ['qa_release'])).toBe('lead');
    expect(actingQaRole(undefined, ['qa_release'])).toBeUndefined();
  });

  it("adds QA Studio to a Developer's own tabs with qa_release", () => {
    const flags = { qaChecklistsEnabled: true };
    const plain = visibleProjectDetailTabs('member', flags);
    const granted = visibleProjectDetailTabs('member', flags, ['qa_release']);
    expect(plain).not.toContain('qa');
    expect(granted).toContain('qa');
    expect(granted.filter((tab) => tab !== 'qa')).toEqual(plain);
    expect(granted).not.toContain('po');
    expect(
      visibleProjectDetailTabs('member', { qaChecklistsEnabled: false }, [
        'qa_release',
      ]),
    ).not.toContain('qa');
  });
});

describe('deployment override', () => {
  const blocked = normalizePromotionStatus({
    eligible: false,
    canMerge: true,
    canOverride: true,
    scope: 'project',
    headSha: 'a'.repeat(40),
    reasons: ['1 item is waiting for the Product owner to pass it'],
    run: {
      id: 'run-1',
      verdict: 'APPROVED',
      signedAt: '2026-10-28T00:00:00Z',
      stale: false,
    },
  });

  it('reads canOverride and offers the override only while the gate is closed', () => {
    expect(blocked.canOverride).toBe(true);
    expect(canOfferOverride(blocked)).toBe(true);
    expect(canOfferOverride({ ...blocked, eligible: true })).toBe(false);
    expect(canOfferOverride({ ...blocked, canOverride: false })).toBe(false);
    expect(canOfferOverride({ ...blocked, run: null })).toBe(false);
    expect(canOfferOverride({ ...blocked, iterationDelivered: true })).toBe(
      false,
    );
    expect(normalizePromotionStatus({}).canOverride).toBe(false);
  });

  it('asks for a reason of at least 15 characters', () => {
    expect(overrideReasonProblem('  too short  ')).toMatch(/15 characters/);
    expect(overrideReasonProblem('Hotfix for checkout outage')).toBeNull();
  });

  it("shows the server's own words for a refused override", () => {
    const cause = {
      status: 403,
      details: {
        code: 'DEPLOYMENT_OVERRIDE_FORBIDDEN',
        message: 'Only an admin may.',
      },
    };
    expect(overrideErrorMessage(cause)).toBe('Only an admin may.');
  });
});

describe('existing repositories in a Project', () => {
  const base = {
    repoFullName: 'acme/orders',
    selectedProjectTypeId: 'dotnet',
    selectedWorkflowRecipeId: 'standard',
    recipesForSelectedProject: [],
    serviceName: '',
    servicePath: '',
    nodeVersion: '',
    coverageThreshold: '80',
    outputFileName: '',
    deploymentProvisioning: undefined,
  };

  it('sends no project name when filing into an existing Project', () => {
    expect(
      existingRepoFiling({
        deliveryProjectId: 'dp',
        projectName: '',
        blocker: null,
      }),
    ).toEqual({
      ok: true,
      projectName: null,
    });
    expect(
      existingRepoFiling({
        deliveryProjectId: undefined,
        projectName: '',
        blocker: null,
      }).ok,
    ).toBe(false);
    expect(
      existingRepoFiling({
        deliveryProjectId: undefined,
        projectName: 'x',
        blocker: 'Pick a Project',
      }),
    ).toEqual({
      ok: false,
      message: 'Pick a Project',
    });
    expect(
      buildSetupExistingRepoPayload({ ...base, projectName: null }),
    ).not.toHaveProperty('projectName');
    expect(
      buildSetupExistingRepoPayload({ ...base, projectName: ' Orders ' })
        .projectName,
    ).toBe('Orders');
  });

  it("links a Project's dialog to the existing-repository mode of the wizard", () => {
    expect(
      attachExistingRepositoryHref('4c1b6f0e-0000-4000-8000-000000000001'),
    ).toBe(
      '/workflows?tab=setup&mode=existing&project=4c1b6f0e-0000-4000-8000-000000000001',
    );
  });
});
