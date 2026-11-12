/* Semantic test coverage: each story's acceptance criteria against its QA
 * test cases, as the server assessed them. Pure types. */

export type CriterionStatus = 'covered' | 'weak' | 'uncovered';
export type StoryCoverageStatus =
  'covered' | 'gaps' | 'untested' | 'no_criteria';

export interface CriterionCoverage {
  text: string;
  status: CriterionStatus;
  score: number;
  matchedTestCaseTitle: string | null;
  missingTerms: string[];
}

export interface StoryCoverage {
  itemId: string;
  title: string;
  featureName: string;
  status: StoryCoverageStatus;
  testCaseCount: number;
  criteria: CriterionCoverage[];
}

export interface CoverageSummary {
  stories: number;
  untested: number;
  noCriteria: number;
  criteria: number;
  criteriaCovered: number;
  criteriaWeak: number;
  criteriaUncovered: number;
  coverageRate: number | null;
}

export interface SemanticCoverage {
  summary: CoverageSummary;
  stories: StoryCoverage[];
}
