/* Semantic test coverage: reading the server's assessment and saying it in
 * product words. Pure: no React, no fetch. */

import type {
  CoverageSummary,
  CriterionCoverage,
  CriterionStatus,
  SemanticCoverage,
  StoryCoverage,
  StoryCoverageStatus,
} from './semantic-coverage-types';
import {
  oneOf,
  record,
  records,
  text,
  texts,
  type Loose,
} from './wire-readers';

const CRITERION_STATUSES: ReadonlyArray<CriterionStatus> = [
  'covered',
  'weak',
  'uncovered',
];
const STORY_STATUSES: ReadonlyArray<StoryCoverageStatus> = [
  'covered',
  'gaps',
  'untested',
  'no_criteria',
];

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function criterionFrom(raw: Loose): CriterionCoverage | null {
  const criterionText = text(raw.text);
  const status = oneOf(raw.status, CRITERION_STATUSES);
  if (!criterionText || !status) return null;
  return {
    text: criterionText,
    status,
    score: count(raw.score),
    matchedTestCaseTitle: text(record(raw.matchedTestCase)?.title),
    missingTerms: texts(raw.missingTerms),
  };
}

function storyFrom(raw: Loose, featureName: string): StoryCoverage | null {
  const itemId = text(raw.itemId);
  const title = text(raw.title);
  const status = oneOf(raw.status, STORY_STATUSES);
  if (!itemId || !title || !status) return null;
  return {
    itemId,
    title,
    featureName,
    status,
    testCaseCount: count(raw.testCaseCount),
    criteria: records(raw.criteria)
      .map(criterionFrom)
      .filter(
        (criterion): criterion is CriterionCoverage => criterion !== null,
      ),
  };
}

function summaryFrom(value: Loose | null): CoverageSummary {
  const raw: Loose = value ?? {};
  const rate = raw.coverageRate;
  return {
    stories: count(raw.stories),
    untested: count(raw.untested),
    noCriteria: count(raw.noCriteria),
    criteria: count(raw.criteria),
    criteriaCovered: count(raw.criteriaCovered),
    criteriaWeak: count(raw.criteriaWeak),
    criteriaUncovered: count(raw.criteriaUncovered),
    coverageRate:
      typeof rate === 'number' && Number.isFinite(rate) ? rate : null,
  };
}

const STORY_ORDER: Readonly<Record<StoryCoverageStatus, number>> = {
  gaps: 0,
  untested: 1,
  no_criteria: 2,
  covered: 3,
};

/** Stories with something to do first: gaps, then untested, then no criteria, then covered. */
export function normalizeSemanticCoverage(value: unknown): SemanticCoverage {
  const raw = record(value) ?? {};
  const stories = records(raw.features).flatMap((feature) => {
    const name = text(feature.name) ?? 'Feature';
    return records(feature.stories)
      .map((story) => storyFrom(story, name))
      .filter((story): story is StoryCoverage => story !== null);
  });
  return {
    summary: summaryFrom(record(raw.summary)),
    stories: stories.sort(
      (a, b) => STORY_ORDER[a.status] - STORY_ORDER[b.status],
    ),
  };
}

function plural(value: number, word: string): string {
  return `${String(value)} ${word}${value === 1 ? '' : 's'}`;
}

/** "7 of 10 acceptance outcomes have a matching test case (70%)." */
export function coverageHeadline(summary: CoverageSummary): string {
  if (summary.criteria === 0)
    return 'No story has acceptance criteria to check yet.';
  const percent =
    summary.coverageRate === null
      ? ''
      : ` (${String(Math.round(summary.coverageRate * 100))}%)`;
  return `${String(summary.criteriaCovered)} of ${plural(summary.criteria, 'acceptance outcome')} have a matching test case${percent}.`;
}

/** "2 weak, 1 uncovered · 1 story without test cases · 2 without criteria", or null when nothing is open. */
export function coverageDetail(summary: CoverageSummary): string | null {
  const parts = [
    summary.criteriaWeak || summary.criteriaUncovered
      ? `${String(summary.criteriaWeak)} weak, ${String(summary.criteriaUncovered)} uncovered`
      : null,
    summary.untested
      ? `${summary.untested === 1 ? '1 story' : `${String(summary.untested)} stories`} without test cases`
      : null,
    summary.noCriteria
      ? `${String(summary.noCriteria)} without criteria`
      : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(' · ') : null;
}

const STORY_LABELS: Readonly<Record<StoryCoverageStatus, string>> = {
  covered: 'Covered',
  gaps: 'Gaps',
  untested: 'No test cases',
  no_criteria: 'No criteria',
};

export function storyCoverageLabel(status: StoryCoverageStatus): string {
  return STORY_LABELS[status];
}

const CRITERION_LABELS: Readonly<Record<CriterionStatus, string>> = {
  covered: 'Covered',
  weak: 'Weak',
  uncovered: 'Uncovered',
};

export function criterionLabel(status: CriterionStatus): string {
  return CRITERION_LABELS[status];
}

/** Under an outcome: what matched it best, and the words no test case says yet. */
export function criterionHint(criterion: CriterionCoverage): string | null {
  if (criterion.status === 'covered') {
    return criterion.matchedTestCaseTitle
      ? `Matched by "${criterion.matchedTestCaseTitle}"`
      : null;
  }
  const missing =
    criterion.missingTerms.length > 0
      ? `No test case mentions: ${criterion.missingTerms.join(', ')}`
      : null;
  const closest = criterion.matchedTestCaseTitle
    ? `Closest: "${criterion.matchedTestCaseTitle}"`
    : null;
  return [closest, missing].filter(Boolean).join(' · ') || null;
}

export function storiesToShow(
  stories: ReadonlyArray<StoryCoverage>,
  showCovered: boolean,
): StoryCoverage[] {
  return showCovered
    ? [...stories]
    : stories.filter((story) => story.status !== 'covered');
}
