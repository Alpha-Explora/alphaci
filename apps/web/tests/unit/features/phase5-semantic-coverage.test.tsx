import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import { SemanticCoverageCard } from '@/features/checklists/semantic-coverage';
import { semanticCoverageRepository } from '@/features/checklists/data/semantic-coverage-repository';
import {
  coverageDetail,
  coverageHeadline,
  criterionHint,
  normalizeSemanticCoverage,
  storiesToShow,
} from '@/features/checklists/model/semantic-coverage-rules';

/* Phase 5, item 7: semantic test coverage of acceptance criteria. */

jest.mock('@/features/checklists/data/semantic-coverage-repository', () => ({
  semanticCoverageRepository: { forProject: jest.fn() },
}));
const repo = semanticCoverageRepository as jest.Mocked<
  typeof semanticCoverageRepository
>;

const WIRE = {
  summary: {
    stories: 2,
    untested: 0,
    noCriteria: 0,
    criteria: 3,
    criteriaCovered: 2,
    criteriaWeak: 0,
    criteriaUncovered: 1,
    coverageRate: 0.67,
  },
  features: [
    {
      name: 'Checkout',
      stories: [
        {
          itemId: 'item-2',
          title: 'Refund',
          status: 'covered',
          testCaseCount: 1,
          criteria: [
            {
              text: 'the refund is issued',
              status: 'covered',
              score: 1,
              matchedTestCase: { id: 't', title: 'Refund issued' },
              missingTerms: [],
            },
          ],
        },
        {
          itemId: 'item-1',
          title: 'Pay by card',
          status: 'gaps',
          testCaseCount: 2,
          criteria: [
            {
              text: 'the order is confirmed',
              status: 'covered',
              score: 1,
              matchedTestCase: { id: 't1', title: 'Pay with a saved card' },
              missingTerms: [],
            },
            {
              text: 'a receipt is emailed',
              status: 'uncovered',
              score: 0,
              matchedTestCase: null,
              missingTerms: ['receipt', 'email'],
            },
          ],
        },
        { itemId: 'broken' },
      ],
    },
  ],
};

describe('semantic coverage rules', () => {
  it('reads the assessment, stories with gaps first, broken rows dropped', () => {
    const coverage = normalizeSemanticCoverage(WIRE);
    expect(
      coverage.stories.map((story) => [
        story.title,
        story.status,
        story.featureName,
      ]),
    ).toEqual([
      ['Pay by card', 'gaps', 'Checkout'],
      ['Refund', 'covered', 'Checkout'],
    ]);
    expect(
      storiesToShow(coverage.stories, false).map((story) => story.title),
    ).toEqual(['Pay by card']);
  });

  it('says where the Project stands, and what an uncovered outcome lacks', () => {
    const coverage = normalizeSemanticCoverage(WIRE);
    expect(coverageHeadline(coverage.summary)).toBe(
      '2 of 3 acceptance outcomes have a matching test case (67%).',
    );
    expect(coverageDetail(coverage.summary)).toBe('0 weak, 1 uncovered');
    expect(
      coverageDetail({
        ...coverage.summary,
        criteriaUncovered: 0,
        untested: 2,
        noCriteria: 1,
      }),
    ).toBe('2 stories without test cases · 1 without criteria');
    expect(criterionHint(coverage.stories[0]!.criteria[1]!)).toBe(
      'No test case mentions: receipt, email',
    );
    expect(criterionHint(coverage.stories[0]!.criteria[0]!)).toBe(
      'Matched by "Pay with a saved card"',
    );
    expect(coverageHeadline({ ...coverage.summary, criteria: 0 })).toBe(
      'No story has acceptance criteria to check yet.',
    );
  });
});

describe('SemanticCoverageCard', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
    jest.resetAllMocks();
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('reads nothing until opened, then shows the gaps', async () => {
    repo.forProject.mockResolvedValue(normalizeSemanticCoverage(WIRE));
    act(() => root.render(<SemanticCoverageCard deliveryProjectId="dp-1" />));
    expect(repo.forProject).not.toHaveBeenCalled();

    const details = host.querySelector('details');
    await act(async () => {
      details!.open = true;
      details!.dispatchEvent(new Event('toggle'));
      await Promise.resolve();
    });

    expect(repo.forProject).toHaveBeenCalledWith('dp-1');
    expect(host.textContent).toContain(
      '2 of 3 acceptance outcomes have a matching test case (67%).',
    );
    expect(host.textContent).toContain('No test case mentions: receipt, email');
    expect(host.textContent).not.toContain('Refund');
  });
});
