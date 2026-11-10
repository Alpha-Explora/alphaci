/**
 * Semantic test coverage: does a User story's QA test cases say what its
 * acceptance criteria say?
 *
 * Deterministic and explainable on purpose. Each outcome of the criteria (the
 * Then clauses of Given/When/Then, or every line when there are none) is
 * compared with every test case by its meaning-bearing words: stop words and
 * Gherkin keywords dropped, simple plurals and tenses folded. An outcome is
 * covered when one test case carries most of its words, weak when it carries
 * some, and uncovered otherwise; the matched and missing words say why. No
 * model is called, so the same story always gets the same answer. Pure.
 */

export type CriterionStatus = 'covered' | 'weak' | 'uncovered';
export type StoryCoverageStatus =
  'covered' | 'gaps' | 'untested' | 'no_criteria';

export interface CoverageTestCase {
  id: string;
  title: string;
  expectedResult: string | null;
}

export interface CoverageStory {
  itemId: string;
  title: string;
  acceptanceCriteria: string | null;
  testCases: CoverageTestCase[];
}

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

export const COVERED_SCORE = 0.6;
export const WEAK_SCORE = 0.3;

const STOP_WORDS = new Set(
  (
    'a an the and or but if then than that this these those of to in on at by for from with without into onto over under ' +
    'is are was were be been being am do does did done has have had having it its as so such not no nor can could ' +
    'should would will shall must may might able user users their them they he she his her we our you your i me my ' +
    'given when also only just all any each every some there here which who whom what where how why after before'
  ).split(' '),
);

const STEP = /^(given|when|then|and|but)\b[\s:,]*/i;
const BULLET = /^\s*(?:[-*•]|\d+[.)])\s*/;

/** Folds "orders"/"ordered"/"ordering" and "entries"/"entry" together. */
export function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 5 && word.endsWith('ing')) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith('ed')) return word.slice(0, -2);
  if (word.length > 4 && /(ses|xes|ches|shes)$/.test(word))
    return word.slice(0, -2);
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss'))
    return word.slice(0, -1);
  return word;
}

/** The meaning-bearing words of a text, folded, in first-seen order and once each. */
export function terms(text: string): string[] {
  const seen = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (!raw || STOP_WORDS.has(raw)) continue;
    if (raw.length < 3 && !/^\d+$/.test(raw)) continue;
    seen.add(stem(raw));
  }
  return [...seen];
}

function clauses(criteria: string): string[] {
  return criteria
    .split(/\r?\n|(?<=[.;])\s+/)
    .map((line) => line.replace(BULLET, '').trim())
    .filter((line) => line.length > 0);
}

/**
 * The outcomes to check: with Given/When/Then, the Then clause and the And/But
 * lines after it; without, every line or sentence.
 */
export function acceptanceOutcomes(criteria: string | null): string[] {
  const lines = clauses(criteria ?? '');
  const hasThen = lines.some((line) => /^then\b/i.test(line));
  if (!hasThen) return lines.filter((line) => terms(line).length > 0);
  const outcomes: string[] = [];
  let inThen = false;
  for (const line of lines) {
    const step = STEP.exec(line)?.[1]?.toLowerCase();
    if (step === 'then') inThen = true;
    else if (step === 'given' || step === 'when') inThen = false;
    const text = line.replace(STEP, '').trim();
    if (inThen && text && terms(text).length > 0) outcomes.push(text);
  }
  return outcomes;
}

function statusOf(score: number): CriterionStatus {
  if (score >= COVERED_SCORE) return 'covered';
  return score >= WEAK_SCORE ? 'weak' : 'uncovered';
}

function assessOutcome(
  outcome: string,
  testCases: ReadonlyArray<{ testCase: CoverageTestCase; terms: Set<string> }>,
): CriterionCoverage {
  const wanted = terms(outcome);
  let best: { testCase: CoverageTestCase; matched: string[] } | null = null;
  for (const candidate of testCases) {
    const matched = wanted.filter((term) => candidate.terms.has(term));
    if (!best || matched.length > best.matched.length)
      best = { testCase: candidate.testCase, matched };
  }
  const matched = best?.matched ?? [];
  const score =
    wanted.length === 0
      ? 0
      : Math.round((matched.length / wanted.length) * 100) / 100;
  return {
    text: outcome,
    status: statusOf(score),
    score,
    matchedTestCase:
      best && matched.length > 0
        ? { id: best.testCase.id, title: best.testCase.title }
        : null,
    matchedTerms: matched,
    missingTerms: wanted.filter((term) => !matched.includes(term)),
  };
}

function storyStatus(
  criteria: CriterionCoverage[],
  testCaseCount: number,
): StoryCoverageStatus {
  if (criteria.length === 0) return 'no_criteria';
  if (testCaseCount === 0) return 'untested';
  return criteria.every((criterion) => criterion.status === 'covered')
    ? 'covered'
    : 'gaps';
}

export function assessStoryCoverage(story: CoverageStory): StoryCoverage {
  const indexed = story.testCases.map((testCase) => ({
    testCase,
    terms: new Set(terms(`${testCase.title} ${testCase.expectedResult ?? ''}`)),
  }));
  const criteria = acceptanceOutcomes(story.acceptanceCriteria).map((outcome) =>
    assessOutcome(outcome, indexed),
  );
  return {
    itemId: story.itemId,
    title: story.title,
    status: storyStatus(criteria, story.testCases.length),
    testCaseCount: story.testCases.length,
    criteria,
  };
}

export function summarizeCoverage(
  stories: ReadonlyArray<StoryCoverage>,
): CoverageSummary {
  const count = (status: StoryCoverageStatus) =>
    stories.filter((story) => story.status === status).length;
  const criteria = stories.flatMap((story) => story.criteria);
  const byStatus = (status: CriterionStatus) =>
    criteria.filter((criterion) => criterion.status === status).length;
  const criteriaCovered = byStatus('covered');
  return {
    stories: stories.length,
    covered: count('covered'),
    gaps: count('gaps'),
    untested: count('untested'),
    noCriteria: count('no_criteria'),
    criteria: criteria.length,
    criteriaCovered,
    criteriaWeak: byStatus('weak'),
    criteriaUncovered: byStatus('uncovered'),
    coverageRate:
      criteria.length === 0
        ? null
        : Math.round((criteriaCovered / criteria.length) * 100) / 100,
  };
}
