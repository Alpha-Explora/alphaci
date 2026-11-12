import { QaSemanticCoverageService } from './qa-semantic-coverage.service';
import type { QaRequirementsService } from './qa-requirements.service';

describe('QaSemanticCoverageService', () => {
  it('assesses every story of the active Iteration against its test cases', async () => {
    const listForProject = jest.fn().mockResolvedValue({
      requirements: [
        {
          id: 'req-1',
          name: 'Checkout',
          items: [
            {
              id: 'item-1',
              title: 'Pay by card',
              acceptanceCriteria: 'Then the order is confirmed',
              testCategories: [
                {
                  id: 'cat-1',
                  name: 'Happy path',
                  testCases: [
                    {
                      id: 'tc-1',
                      title: 'Order confirmed after paying',
                      expectedResult: null,
                    },
                  ],
                },
              ],
            },
            {
              id: 'item-2',
              title: 'Refund',
              acceptanceCriteria: null,
              testCategories: [],
            },
          ],
        },
      ],
    });
    const service = new QaSemanticCoverageService({
      listForProject,
    } as unknown as QaRequirementsService);

    const coverage = await service.forProject('dp-1', 'qa-1');

    expect(listForProject).toHaveBeenCalledWith('dp-1', 'qa-1', {
      kind: 'functional',
      includeArchived: false,
    });
    expect(coverage.features[0]?.stories.map((story) => story.status)).toEqual([
      'covered',
      'no_criteria',
    ]);
    expect(coverage.summary).toMatchObject({
      stories: 2,
      covered: 1,
      noCriteria: 1,
      criteria: 1,
      coverageRate: 1,
    });
    expect(coverage.method).toBe('keyword-overlap');
  });
});
