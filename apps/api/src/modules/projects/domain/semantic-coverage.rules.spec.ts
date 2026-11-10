import {
  acceptanceOutcomes,
  assessStoryCoverage,
  stem,
  summarizeCoverage,
  terms,
} from './semantic-coverage.rules';

describe('semantic coverage rules', () => {
  it('reads the Then outcomes of Given/When/Then, and every line without them', () => {
    expect(
      acceptanceOutcomes(
        'Given a saved card\nWhen I pay\nThen the order is confirmed\nAnd a receipt is emailed\nGiven an expired card\nThen payment is declined',
      ),
    ).toEqual([
      'the order is confirmed',
      'a receipt is emailed',
      'payment is declined',
    ]);
    expect(
      acceptanceOutcomes('- Totals include VAT\n- Discount codes apply once'),
    ).toEqual(['Totals include VAT', 'Discount codes apply once']);
    expect(acceptanceOutcomes(null)).toEqual([]);
  });

  it('keeps meaning-bearing words and folds plurals and tenses', () => {
    expect(terms('The orders are shipped to the users')).toEqual([
      'order',
      'shipp',
    ]);
    expect(stem('entries')).toBe('entry');
    expect(stem('emailed')).toBe('email');
    expect(stem('boxes')).toBe('box');
    expect(stem('class')).toBe('class');
    expect(terms('Shows 404 for a missing page')).toEqual([
      'show',
      '404',
      'miss',
      'page',
    ]);
  });

  it('covers an outcome a test case states, and names what an uncovered one lacks', () => {
    const coverage = assessStoryCoverage({
      itemId: 'item-1',
      title: 'Pay by card',
      acceptanceCriteria:
        'Given a saved card\nWhen I pay\nThen the order is confirmed\nAnd a receipt is emailed',
      testCases: [
        {
          id: 'tc-1',
          title: 'Pay with a saved card',
          expectedResult: 'Order confirmed page is shown',
        },
        { id: 'tc-2', title: 'Decline an expired card', expectedResult: null },
      ],
    });

    expect(coverage.status).toBe('gaps');
    expect(coverage.criteria[0]).toMatchObject({
      text: 'the order is confirmed',
      status: 'covered',
      score: 1,
      matchedTestCase: { id: 'tc-1', title: 'Pay with a saved card' },
    });
    expect(coverage.criteria[1]).toMatchObject({
      text: 'a receipt is emailed',
      status: 'uncovered',
      score: 0,
      matchedTestCase: null,
      missingTerms: ['receipt', 'email'],
    });
  });

  it('calls a partial match weak, and every story state by name', () => {
    const weak = assessStoryCoverage({
      itemId: 'i',
      title: 't',
      acceptanceCriteria:
        'Then the refund appears on the statement within five days',
      testCases: [
        {
          id: 'tc',
          title: 'Refund is issued',
          expectedResult: 'Statement updated',
        },
      ],
    });
    expect(weak.criteria[0]?.status).toBe('weak');

    const untested = assessStoryCoverage({
      itemId: 'i',
      title: 't',
      acceptanceCriteria: 'Totals include VAT',
      testCases: [],
    });
    const none = assessStoryCoverage({
      itemId: 'i',
      title: 't',
      acceptanceCriteria: null,
      testCases: [],
    });
    const covered = assessStoryCoverage({
      itemId: 'i',
      title: 't',
      acceptanceCriteria: 'Totals include VAT',
      testCases: [
        { id: 'tc', title: 'Cart totals include VAT', expectedResult: null },
      ],
    });
    expect([untested.status, none.status, covered.status]).toEqual([
      'untested',
      'no_criteria',
      'covered',
    ]);

    expect(summarizeCoverage([weak, untested, none, covered])).toEqual({
      stories: 4,
      covered: 1,
      gaps: 1,
      untested: 1,
      noCriteria: 1,
      criteria: 3,
      criteriaCovered: 1,
      criteriaWeak: 1,
      criteriaUncovered: 1,
      coverageRate: 0.33,
    });
    expect(summarizeCoverage([none]).coverageRate).toBeNull();
  });

  it('is deterministic', () => {
    const story = {
      itemId: 'i',
      title: 't',
      acceptanceCriteria: 'Then the basket is emptied',
      testCases: [
        {
          id: 'a',
          title: 'Basket emptied after checkout',
          expectedResult: null,
        },
      ],
    };
    expect(assessStoryCoverage(story)).toEqual(assessStoryCoverage(story));
  });
});
