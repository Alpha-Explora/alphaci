export type CriterionStatus = 'covered' | 'weak' | 'uncovered';
export type StoryCoverageStatus =
  'covered' | 'gaps' | 'untested' | 'no_criteria';

export interface CriterionCoverage {
  /** The outcome as written, without its Then/And keyword. */
  text: string;
  status: CriterionStatus;
  /** Share of the outcome's words the best test case carries, 0 to 1. */
  score: number;
  matchedTestCase: { id: string; title: string } | null;
  matchedTerms: string[];
  missingTerms: string[];
}

export interface StoryCoverage {
  itemId: string;
  title: string;
  status: StoryCoverageStatus;
  testCaseCount: number;
  criteria: CriterionCoverage[];
}

export interface CoverageSummary {
  stories: number;
  covered: number;
  gaps: number;
  untested: number;
  noCriteria: number;
  criteria: number;
  criteriaCovered: number;
  criteriaWeak: number;
  criteriaUncovered: number;
  /** criteriaCovered / criteria, or null when no story has criteria. */
  coverageRate: number | null;
}

/** `GET /delivery-projects/:id/semantic-coverage` */
export interface ProjectSemanticCoverage {
  deliveryProjectId: string;
  generatedAt: string;
  /** How outcomes are matched, for the screen to say plainly. */
  method: 'keyword-overlap';
  thresholds: { covered: number; weak: number };
  summary: CoverageSummary;
  features: Array<{
    requirementId: string;
    name: string;
    stories: StoryCoverage[];
  }>;
}
